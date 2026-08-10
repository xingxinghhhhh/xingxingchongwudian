import { ConfigService } from "@nestjs/config";
import {
  SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS,
  SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS,
  SqliteRecoveryAutoRefreshService
} from "./sqlite-recovery-auto-refresh";

function config(enabled: string | undefined) {
  return new ConfigService({
    SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: enabled
  });
}

function createService(
  enabled: string | undefined,
  status: {
    status: "no_backup" | "backup_unverified" | "recoverable" | "drill_failed" | "unavailable";
    freshness: "fresh" | "stale" | "unknown";
  },
  createAndVerify = jest.fn().mockResolvedValue({
    status: "recoverable",
    freshness: "fresh"
  })
) {
  return {
    service: new SqliteRecoveryAutoRefreshService(
      config(enabled),
      { getStatus: jest.fn().mockResolvedValue(status) } as never,
      { createAndVerify } as never
    ),
    createAndVerify
  };
}

describe("SqliteRecoveryAutoRefreshService", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is disabled by default and never starts a timer", async () => {
    jest.useFakeTimers();
    const { service, createAndVerify } = createService(undefined, {
      status: "no_backup",
      freshness: "unknown"
    });

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(
      SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS +
        SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS
    );

    expect(service.isEnabled()).toBe(false);
    expect(createAndVerify).not.toHaveBeenCalled();
    expect(service.getRuntimeStatus()).toEqual({
      lastCheckedAt: null,
      lastOutcome: "not_run_yet",
      reasonCode: null,
      suppressionActive: false,
      nextCheckAt: null
    });
    service.onModuleDestroy();
  });

  it.each([
    ["no_backup", "unknown"],
    ["recoverable", "stale"]
  ] as const)("refreshes %s/%s", async (status, freshness) => {
    const { service, createAndVerify } = createService("true", {
      status,
      freshness
    });

    await service.runCheck();

    expect(createAndVerify).toHaveBeenCalledTimes(1);
    expect(service.getRuntimeStatus()).toMatchObject({
      lastOutcome: "run_succeeded",
      reasonCode: null,
      suppressionActive: false
    });
  });

  it.each([
    ["recoverable", "fresh"],
    ["backup_unverified", "fresh"],
    ["drill_failed", "fresh"],
    ["unavailable", "unknown"]
  ] as const)("skips %s/%s without recovery", async (status, freshness) => {
    const { service, createAndVerify } = createService("true", {
      status,
      freshness
    });

    await service.runCheck();

    expect(createAndVerify).not.toHaveBeenCalled();
    expect(service.getRuntimeStatus()).toMatchObject({
      lastOutcome:
        status === "recoverable" && freshness === "fresh"
          ? "skipped_fresh"
          : "skipped_ineligible",
      reasonCode: status
    });
  });

  it("skips an existing manual run without suppressing the next check", async () => {
    const createAndVerify = jest
      .fn()
      .mockRejectedValueOnce({ code: "SQLITE_RECOVERY_ALREADY_RUNNING" })
      .mockResolvedValueOnce({ status: "recoverable", freshness: "fresh" });
    const { service } = createService("true", {
      status: "no_backup",
      freshness: "unknown"
    }, createAndVerify);

    await service.runCheck();
    await service.runCheck();

    expect(createAndVerify).toHaveBeenCalledTimes(2);
    expect(service.getRuntimeStatus()).toMatchObject({
      lastOutcome: "run_succeeded",
      reasonCode: null
    });
  });

  it("suppresses repeated automatic execution after a real failure", async () => {
    const createAndVerify = jest.fn().mockRejectedValue(new Error("backup failed"));
    const { service } = createService("true", {
      status: "no_backup",
      freshness: "unknown"
    }, createAndVerify);

    await service.runCheck();
    await service.runCheck();

    expect(createAndVerify).toHaveBeenCalledTimes(1);
    expect(service.getRuntimeStatus()).toMatchObject({
      lastOutcome: "skipped_suppressed",
      reasonCode: "UNEXPECTED_ERROR",
      suppressionActive: true
    });
  });

  it("clears the startup and interval timers on shutdown", async () => {
    jest.useFakeTimers();
    const { service, createAndVerify } = createService("true", {
      status: "no_backup",
      freshness: "unknown"
    });

    service.onModuleInit();
    expect(service.getRuntimeStatus().nextCheckAt).not.toBeNull();
    service.onModuleDestroy();
    expect(service.getRuntimeStatus().nextCheckAt).toBeNull();
    await jest.advanceTimersByTimeAsync(
      SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS +
        SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS
    );

    expect(createAndVerify).not.toHaveBeenCalled();
  });
});
