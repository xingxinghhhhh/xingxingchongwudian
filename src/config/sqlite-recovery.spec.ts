import {
  DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS,
  resolveSqliteRecoveryMaxBackupAgeHours
} from "./sqlite-recovery";

describe("resolveSqliteRecoveryMaxBackupAgeHours", () => {
  it("uses the documented 24 hour fallback", () => {
    expect(resolveSqliteRecoveryMaxBackupAgeHours({ NODE_ENV: "test" })).toBe(
      DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS
    );
  });

  it.each(["1", "24", "720"])("accepts an integer in range: %s", (value) => {
    expect(
      resolveSqliteRecoveryMaxBackupAgeHours({
        SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: value
      })
    ).toBe(Number(value));
  });

  it.each(["0", "721", "-1", "1.5", "twenty-four"])(
    "rejects an invalid freshness window: %s",
    (value) => {
      expect(() =>
        resolveSqliteRecoveryMaxBackupAgeHours({
          SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: value
        })
      ).toThrow("SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS must be an integer between 1 and 720");
    }
  );
});
