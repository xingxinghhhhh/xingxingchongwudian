import {
  DEFAULT_SQLITE_RECOVERY_AUTO_REFRESH_ENABLED,
  resolveSqliteRecoveryAutoRefreshEnabled
} from "./sqlite-recovery-auto-refresh";

describe("resolveSqliteRecoveryAutoRefreshEnabled", () => {
  it("defaults to disabled", () => {
    expect(resolveSqliteRecoveryAutoRefreshEnabled({ NODE_ENV: "test" })).toBe(
      DEFAULT_SQLITE_RECOVERY_AUTO_REFRESH_ENABLED
    );
  });

  it.each(["true", "false"])("accepts the strict boolean value: %s", (value) => {
    expect(
      resolveSqliteRecoveryAutoRefreshEnabled({
        SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: value
      })
    ).toBe(value === "true");
  });

  it.each(["TRUE", "1", "yes", "enabled"])(
    "rejects a non-strict value: %s",
    (value) => {
      expect(() =>
        resolveSqliteRecoveryAutoRefreshEnabled({
          SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: value
        })
      ).toThrow("SQLITE_RECOVERY_AUTO_REFRESH_ENABLED must be true or false");
    }
  );
});
