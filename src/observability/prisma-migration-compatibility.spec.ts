import { resolvePrismaMigrationCompatibility } from "./prisma-migration-compatibility";

const applied = [{ finished_at: "2026-08-10T00:00:00.000Z", rolled_back_at: null }];

describe("resolvePrismaMigrationCompatibility", () => {
  it("returns unavailable when the database is not configured", async () => {
    const runMigrationDiff = jest.fn();

    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: false,
        readMigrationState: jest.fn(),
        runMigrationDiff
      })
    ).resolves.toEqual({ status: "unavailable" });
    expect(runMigrationDiff).not.toHaveBeenCalled();
  });

  it("returns compatible when the existing migration diff gate reports no diff", async () => {
    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: true,
        readMigrationState: jest.fn().mockResolvedValue(applied),
        runMigrationDiff: jest.fn().mockResolvedValue(0)
      })
    ).resolves.toEqual({ status: "compatible" });
  });

  it("returns mismatch for a pending schema diff", async () => {
    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: true,
        readMigrationState: jest.fn().mockResolvedValue(applied),
        runMigrationDiff: jest.fn().mockResolvedValue(2)
      })
    ).resolves.toEqual({ status: "mismatch" });
  });

  it("returns mismatch for an unfinished migration state without running the CLI", async () => {
    const runMigrationDiff = jest.fn();

    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: true,
        readMigrationState: jest
          .fn()
          .mockResolvedValue([{ finished_at: null, rolled_back_at: null }]),
        runMigrationDiff
      })
    ).resolves.toEqual({ status: "mismatch" });
    expect(runMigrationDiff).not.toHaveBeenCalled();
  });

  it("fails closed when the migration gate cannot be evaluated", async () => {
    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: true,
        readMigrationState: jest.fn().mockResolvedValue(applied),
        runMigrationDiff: jest.fn().mockResolvedValue(1)
      })
    ).resolves.toEqual({ status: "unavailable" });

    await expect(
      resolvePrismaMigrationCompatibility({
        databaseConfigured: true,
        readMigrationState: jest.fn().mockRejectedValue(new Error("private db error")),
        runMigrationDiff: jest.fn()
      })
    ).resolves.toEqual({ status: "unavailable" });
  });
});
