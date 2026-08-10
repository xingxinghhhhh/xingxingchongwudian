import { ConfigService } from "@nestjs/config";
import {
  createSqliteBackup,
  runSqliteRestoreDrillWithAttestation
} from "../operations/sqlite-recovery";
import { readSqliteRecoveryStatus } from "./sqlite-recovery-status";
import {
  SqliteRecoveryNotConfiguredError,
  SqliteRecoveryOperationsService,
  SqliteRecoveryRunInProgressError
} from "./sqlite-recovery-operations";

jest.mock("../operations/sqlite-recovery", () => {
  const actual = jest.requireActual("../operations/sqlite-recovery");
  return {
    ...actual,
    createSqliteBackup: jest.fn(),
    runSqliteRestoreDrillWithAttestation: jest.fn()
  };
});

jest.mock("./sqlite-recovery-status", () => ({
  readSqliteRecoveryStatus: jest.fn()
}));

const mockedCreateBackup = jest.mocked(createSqliteBackup);
const mockedRunDrill = jest.mocked(runSqliteRestoreDrillWithAttestation);
const mockedReadStatus = jest.mocked(readSqliteRecoveryStatus);

function config(values: Record<string, string | undefined>) {
  return {
    get: jest.fn((key: string) => values[key])
  } as unknown as ConfigService;
}

describe("SqliteRecoveryOperationsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateBackup.mockResolvedValue({
      backupPath: "D:/recovery/cloud-pets-now.sqlite",
      manifestPath: "D:/recovery/cloud-pets-now.manifest.json",
      manifest: {} as never
    });
    mockedRunDrill.mockResolvedValue({ manifest: {} as never });
    mockedReadStatus.mockResolvedValue({
      status: "recoverable",
      freshness: "fresh",
      maxBackupAgeHours: 24
    });
  });

  it("runs backup then restore drill and returns the fresh status", async () => {
    const service = new SqliteRecoveryOperationsService(
      config({
        SQLITE_RECOVERY_STATUS_DIR: "D:/recovery",
        DATABASE_URL: "file:D:/data.db",
        SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24"
      })
    );

    await expect(service.createAndVerify()).resolves.toMatchObject({
      status: "recoverable",
      freshness: "fresh"
    });
    expect(mockedCreateBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        outputDirectory: "D:/recovery",
        databaseUrl: "file:D:/data.db"
      })
    );
    expect(mockedRunDrill).toHaveBeenCalledWith({
      manifestPath: "D:/recovery/cloud-pets-now.manifest.json"
    });
  });

  it("rejects an unconfigured operation without running recovery", async () => {
    const service = new SqliteRecoveryOperationsService(config({}));

    await expect(service.createAndVerify()).rejects.toBeInstanceOf(
      SqliteRecoveryNotConfiguredError
    );
    expect(mockedCreateBackup).not.toHaveBeenCalled();
  });

  it("rejects concurrent runs and releases the mutex after completion", async () => {
    let resolveBackup!: (value: Awaited<ReturnType<typeof createSqliteBackup>>) => void;
    mockedCreateBackup.mockReturnValue(
      new Promise((resolve) => {
        resolveBackup = resolve;
      })
    );
    const service = new SqliteRecoveryOperationsService(
      config({ SQLITE_RECOVERY_STATUS_DIR: "D:/recovery" })
    );

    const firstRun = service.createAndVerify();
    await expect(service.createAndVerify()).rejects.toBeInstanceOf(
      SqliteRecoveryRunInProgressError
    );
    resolveBackup({
      backupPath: "D:/recovery/cloud-pets-now.sqlite",
      manifestPath: "D:/recovery/cloud-pets-now.manifest.json",
      manifest: {} as never
    });
    await firstRun;
    await expect(service.createAndVerify()).resolves.toMatchObject({
      status: "recoverable"
    });
  });

  it("releases the mutex when the drill fails", async () => {
    mockedRunDrill.mockRejectedValue(new Error("drill failed"));
    const service = new SqliteRecoveryOperationsService(
      config({ SQLITE_RECOVERY_STATUS_DIR: "D:/recovery" })
    );

    await expect(service.createAndVerify()).rejects.toThrow("drill failed");
    mockedRunDrill.mockResolvedValue({ manifest: {} as never });
    await expect(service.createAndVerify()).resolves.toMatchObject({
      status: "recoverable"
    });
  });
});
