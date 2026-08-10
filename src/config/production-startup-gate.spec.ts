import {
  assertProductionMigrationCompatibility,
  assertProductionBuildReleaseMarker,
  assertProductionStartupCompatibility,
  initializeAndListenWithProductionGate,
  ProductionStartupGateError,
  RELEASE_BUILD_ID_MISMATCH_STARTUP_ERROR_CODE,
  RELEASE_BUILD_MARKER_INVALID_STARTUP_ERROR_CODE,
  RELEASE_ID_UNCONFIGURED_STARTUP_ERROR_CODE,
  SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE,
  SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE,
  assertProductionReleaseIdentity
} from "./production-startup-gate";

describe("production startup migration gate", () => {
  it("allows compatible production migrations", () => {
    expect(() =>
      assertProductionMigrationCompatibility(true, "compatible")
    ).not.toThrow();
  });

  it("allows only a matched production baseline", () => {
    expect(() =>
      assertProductionStartupCompatibility(
        true,
        "matched",
        "production-release",
        { status: "identified", releaseId: "production-release" },
        "compatible"
      )
    ).not.toThrow();
    expect(() =>
      assertProductionStartupCompatibility(
        true,
        "unconfigured",
        undefined,
        { status: "missing" },
        "compatible"
      )
    ).toThrow(
      `${SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE} (unconfigured)`
    );
  });

  it("blocks only an explicitly mismatched production baseline", () => {
    expect(() =>
      assertProductionStartupCompatibility(
        true,
        "mismatch",
        undefined,
        { status: "missing" },
        "compatible"
      )
    ).toThrow(`${SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE} (mismatch)`);
    expect(() =>
      assertProductionStartupCompatibility(
        false,
        "mismatch",
        undefined,
        { status: "missing" },
        "unavailable"
      )
    ).not.toThrow();
  });

  it("blocks mismatched or unavailable production migrations with one safe error code", () => {
    expect(() =>
      assertProductionMigrationCompatibility(true, "mismatch")
    ).toThrow(ProductionStartupGateError);
    expect(() =>
      assertProductionMigrationCompatibility(true, "unavailable")
    ).toThrow("PRISMA_MIGRATION_NOT_COMPATIBLE (unavailable)");
  });

  it("keeps non-production startup behavior unchanged", () => {
    expect(() =>
      assertProductionMigrationCompatibility(false, "unavailable")
    ).not.toThrow();
    expect(() => assertProductionReleaseIdentity(false, null)).not.toThrow();
    expect(() =>
      assertProductionBuildReleaseMarker(false, { status: "missing" }, undefined)
    ).not.toThrow();
  });

  it("does not listen or rerun the checker when the production gate fails", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3000,
        getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
        getReleaseId: jest.fn().mockReturnValue("production-release"),
        getBuildReleaseMarker: jest
          .fn()
          .mockReturnValue({ status: "identified", releaseId: "production-release" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: "PRISMA_MIGRATION_NOT_COMPATIBLE",
      migrationStatus: "mismatch"
    });
    expect(app.init).toHaveBeenCalledTimes(1);
    expect(getMigrationStatus).toHaveBeenCalledTimes(1);
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("listens normally after a compatible snapshot", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("compatible" as const);

    await initializeAndListenWithProductionGate(app, {
      production: true,
      port: 3010,
      getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
      getReleaseId: jest.fn().mockReturnValue("production-release"),
      getBuildReleaseMarker: jest
        .fn()
        .mockReturnValue({ status: "identified", releaseId: "production-release" } as const),
      getMigrationStatus
    });
    expect(app.listen).toHaveBeenCalledWith(3010);
    expect(app.close).not.toHaveBeenCalled();
  });

  it("prioritizes config mismatch and does not read migration status", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("compatible" as const);
    const getReleaseId = jest.fn().mockReturnValue("production-release");
    const getBuildReleaseMarker = jest
      .fn()
      .mockReturnValue({ status: "identified", releaseId: "production-release" } as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3020,
        getConfigBaselineStatus: jest.fn().mockReturnValue("mismatch" as const),
        getReleaseId,
        getBuildReleaseMarker,
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE,
      configBaselineStatus: "mismatch"
    });
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(getReleaseId).not.toHaveBeenCalled();
    expect(getBuildReleaseMarker).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("fails closed for an unconfigured production baseline before reading migrations", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);
    const getReleaseId = jest.fn().mockReturnValue(undefined);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3030,
        getConfigBaselineStatus: jest.fn().mockReturnValue("unconfigured" as const),
        getReleaseId,
        getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "missing" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE,
      configBaselineStatus: "unconfigured"
    });
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(getReleaseId).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("preserves non-production startup when the baseline is unconfigured", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };

    await initializeAndListenWithProductionGate(app, {
      production: false,
      port: 3040,
      getConfigBaselineStatus: jest.fn().mockReturnValue("unconfigured" as const),
      getReleaseId: jest.fn().mockReturnValue(undefined),
      getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "missing" } as const),
      getMigrationStatus: jest.fn().mockReturnValue("unavailable" as const)
    });
    expect(app.listen).toHaveBeenCalledWith(3040);
    expect(app.close).not.toHaveBeenCalled();
  });

  it("fails closed for a missing production release before reading migrations", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getReleaseId = jest.fn().mockReturnValue(undefined);
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3050,
        getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
        getReleaseId,
        getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "missing" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: RELEASE_ID_UNCONFIGURED_STARTUP_ERROR_CODE,
      releaseStatus: "unidentified"
    });
    expect(getReleaseId).toHaveBeenCalledTimes(1);
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("keeps the config gate ahead of a missing release", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getReleaseId = jest.fn().mockReturnValue(undefined);
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3060,
        getConfigBaselineStatus: jest.fn().mockReturnValue("unconfigured" as const),
        getReleaseId,
        getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "missing" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE
    });
    expect(getReleaseId).not.toHaveBeenCalled();
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("fails closed for an invalid build marker before reading migrations", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3070,
        getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
        getReleaseId: jest.fn().mockReturnValue("production-release"),
        getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "invalid" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: RELEASE_BUILD_MARKER_INVALID_STARTUP_ERROR_CODE,
      buildMarkerStatus: "invalid"
    });
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the build release differs from the runtime release", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const getMigrationStatus = jest.fn().mockReturnValue("mismatch" as const);

    await expect(
      initializeAndListenWithProductionGate(app, {
        production: true,
        port: 3080,
        getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
        getReleaseId: jest.fn().mockReturnValue("runtime-release"),
        getBuildReleaseMarker: jest
          .fn()
          .mockReturnValue({ status: "identified", releaseId: "other-release" } as const),
        getMigrationStatus
      })
    ).rejects.toMatchObject({
      code: RELEASE_BUILD_ID_MISMATCH_STARTUP_ERROR_CODE,
      buildMarkerStatus: "mismatch"
    });
    expect(getMigrationStatus).not.toHaveBeenCalled();
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
  });

  it("keeps a non-production missing marker non-blocking", async () => {
    const app = {
      init: jest.fn().mockResolvedValue(undefined),
      listen: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };

    await initializeAndListenWithProductionGate(app, {
      production: false,
      port: 3090,
      getConfigBaselineStatus: jest.fn().mockReturnValue("matched" as const),
      getReleaseId: jest.fn().mockReturnValue(undefined),
      getBuildReleaseMarker: jest.fn().mockReturnValue({ status: "missing" } as const),
      getMigrationStatus: jest.fn().mockReturnValue("unavailable" as const)
    });
    expect(app.listen).toHaveBeenCalledWith(3090);
    expect(app.close).not.toHaveBeenCalled();
  });
});
