import {
  CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
  computeCloudPetSafeConfigSha256,
  getCloudPetConfigBaselineStatus,
  resolveCloudPetExpectedSafeConfigSha256,
  resolveCloudPetSafeConfig
} from "./cloud-pet-config-fingerprint";

const baseConfig = {
  NODE_ENV: "production",
  DATABASE_URL: "file:./private.db",
  KZT_USE_MEMORY_STORE: "false",
  WEB_ORIGIN: "https://pets.example.com/",
  TRUST_PROXY_HOPS: "1",
  API_BODY_LIMIT_BYTES: "65536",
  MEMBER_AUTH_PROVIDER: "webhook",
  SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
  SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "true"
};

describe("cloud-pet config fingerprint", () => {
  it("is deterministic and independent of input key order", () => {
    const reordered = {
      SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: "true",
      MEMBER_AUTH_PROVIDER: "webhook",
      TRUST_PROXY_HOPS: "1",
      WEB_ORIGIN: "https://pets.example.com",
      API_BODY_LIMIT_BYTES: "65536",
      SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: "24",
      KZT_USE_MEMORY_STORE: "false",
      DATABASE_URL: "file:another-private.db",
      NODE_ENV: "production"
    };

    expect(computeCloudPetSafeConfigSha256(baseConfig)).toBe(
      computeCloudPetSafeConfigSha256(reordered)
    );
  });

  it("changes when an allowlisted non-secret setting changes", () => {
    expect(
      computeCloudPetSafeConfigSha256({
        ...baseConfig,
        API_BODY_LIMIT_BYTES: "131072"
      })
    ).not.toBe(computeCloudPetSafeConfigSha256(baseConfig));
  });

  it("does not change when a secret or database path changes", () => {
    expect(
      computeCloudPetSafeConfigSha256({
        ...baseConfig,
        DATABASE_URL: "file:changed-private.db",
        MEMBER_AUTH_CODE_SECRET: "changed-secret",
        OPS_METRICS_TOKEN: "changed-ops-token"
      })
    ).toBe(computeCloudPetSafeConfigSha256(baseConfig));
  });

  it("does not change when the release id changes", () => {
    const first = computeCloudPetSafeConfigSha256({
      ...baseConfig,
      CLOUD_PET_RELEASE_ID: "release-a"
    });
    const second = computeCloudPetSafeConfigSha256({
      ...baseConfig,
      CLOUD_PET_RELEASE_ID: "release-b"
    });

    expect(second).toBe(first);
  });

  it("returns matched, unconfigured, and mismatch baseline states", () => {
    const expected = computeCloudPetSafeConfigSha256(baseConfig);
    expect(getCloudPetConfigBaselineStatus(baseConfig)).toBe("unconfigured");
    expect(
      getCloudPetConfigBaselineStatus({
        ...baseConfig,
        [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: expected
      })
    ).toBe("matched");
    expect(
      getCloudPetConfigBaselineStatus({
        ...baseConfig,
        [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: "a".repeat(64)
      })
    ).toBe("mismatch");
  });

  it("strictly validates the expected fingerprint format", () => {
    expect(() =>
      resolveCloudPetExpectedSafeConfigSha256({
        [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: "A".repeat(64)
      })
    ).toThrow("64 lowercase hexadecimal");
    expect(() =>
      resolveCloudPetExpectedSafeConfigSha256({
        [CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256]: "not-a-hash"
      })
    ).toThrow("64 lowercase hexadecimal");
  });

  it("returns only the explicit safe configuration projection", () => {
    expect(resolveCloudPetSafeConfig(baseConfig)).toEqual({
      nodeEnv: "production",
      webOrigin: "https://pets.example.com",
      trustedProxyHops: 1,
      apiBodyLimitBytes: 65536,
      persistenceMode: "prisma_sqlite",
      memberAuthProvider: "webhook",
      sqliteRecoveryMaxBackupAgeHours: 24,
      sqliteRecoveryAutoRefreshEnabled: true
    });
  });
});
