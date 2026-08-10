import type { PrismaMigrationCompatibilityStatus } from "../observability/prisma-migration-compatibility";
import type { CloudPetConfigBaselineStatus } from "./cloud-pet-config-fingerprint";
import type { CloudPetReleaseMarkerStatus } from "./cloud-pet-release-marker";

export const PRISMA_MIGRATION_STARTUP_ERROR_CODE =
  "PRISMA_MIGRATION_NOT_COMPATIBLE" as const;
export const SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE =
  "SAFE_CONFIG_BASELINE_MISMATCH" as const;
export const SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE =
  "SAFE_CONFIG_BASELINE_UNCONFIGURED" as const;
export const RELEASE_ID_UNCONFIGURED_STARTUP_ERROR_CODE =
  "RELEASE_ID_UNCONFIGURED_STARTUP" as const;
export const RELEASE_BUILD_MARKER_INVALID_STARTUP_ERROR_CODE =
  "RELEASE_BUILD_MARKER_INVALID_STARTUP" as const;
export const RELEASE_BUILD_ID_MISMATCH_STARTUP_ERROR_CODE =
  "RELEASE_BUILD_ID_MISMATCH_STARTUP" as const;

export type ProductionStartupGateErrorCode =
  | typeof PRISMA_MIGRATION_STARTUP_ERROR_CODE
  | typeof SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE
  | typeof SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE
  | typeof RELEASE_ID_UNCONFIGURED_STARTUP_ERROR_CODE
  | typeof RELEASE_BUILD_MARKER_INVALID_STARTUP_ERROR_CODE
  | typeof RELEASE_BUILD_ID_MISMATCH_STARTUP_ERROR_CODE;

export class ProductionStartupGateError extends Error {
  constructor(
    readonly code: ProductionStartupGateErrorCode,
    details: {
      migrationStatus?: Exclude<PrismaMigrationCompatibilityStatus, "compatible">;
      configBaselineStatus?: Exclude<CloudPetConfigBaselineStatus, "matched">;
      releaseStatus?: "unidentified";
      buildMarkerStatus?: "missing" | "invalid" | "mismatch";
    }
  ) {
    const detail =
      details.configBaselineStatus ??
      details.releaseStatus ??
      details.buildMarkerStatus ??
      details.migrationStatus ??
      "unknown";
    super(`${code} (${detail})`);
    this.name = "ProductionStartupGateError";
    Object.assign(this, details);
  }

  readonly migrationStatus?: Exclude<
    PrismaMigrationCompatibilityStatus,
    "compatible"
  >;

  readonly configBaselineStatus?: Exclude<CloudPetConfigBaselineStatus, "matched">;

  readonly releaseStatus?: "unidentified";

  readonly buildMarkerStatus?: "missing" | "invalid" | "mismatch";
}

export function assertProductionMigrationCompatibility(
  production: boolean,
  migrationStatus: PrismaMigrationCompatibilityStatus
) {
  if (production && migrationStatus !== "compatible") {
    throw new ProductionStartupGateError(PRISMA_MIGRATION_STARTUP_ERROR_CODE, {
      migrationStatus
    });
  }
}

export function assertProductionConfigBaseline(
  production: boolean,
  configBaselineStatus: CloudPetConfigBaselineStatus
) {
  if (production && configBaselineStatus !== "matched") {
    throw new ProductionStartupGateError(
      configBaselineStatus === "unconfigured"
        ? SAFE_CONFIG_BASELINE_UNCONFIGURED_STARTUP_ERROR_CODE
        : SAFE_CONFIG_BASELINE_STARTUP_ERROR_CODE,
      { configBaselineStatus }
    );
  }
}

export function assertProductionReleaseIdentity(
  production: boolean,
  releaseId: string | null | undefined
) {
  if (production && (!releaseId || releaseId.trim().length === 0)) {
    throw new ProductionStartupGateError(
      RELEASE_ID_UNCONFIGURED_STARTUP_ERROR_CODE,
      { releaseStatus: "unidentified" }
    );
  }
}

export function assertProductionBuildReleaseMarker(
  production: boolean,
  marker: CloudPetReleaseMarkerStatus,
  runtimeReleaseId: string | null | undefined
) {
  if (!production) return;
  if (marker.status !== "identified") {
    throw new ProductionStartupGateError(
      RELEASE_BUILD_MARKER_INVALID_STARTUP_ERROR_CODE,
      { buildMarkerStatus: marker.status }
    );
  }
  if (marker.releaseId !== runtimeReleaseId) {
    throw new ProductionStartupGateError(
      RELEASE_BUILD_ID_MISMATCH_STARTUP_ERROR_CODE,
      { buildMarkerStatus: "mismatch" }
    );
  }
}

export function assertProductionStartupCompatibility(
  production: boolean,
  configBaselineStatus: CloudPetConfigBaselineStatus,
  releaseId: string | null | undefined,
  buildReleaseMarker: CloudPetReleaseMarkerStatus,
  migrationStatus: PrismaMigrationCompatibilityStatus
) {
  assertProductionConfigBaseline(production, configBaselineStatus);
  assertProductionReleaseIdentity(production, releaseId);
  assertProductionBuildReleaseMarker(production, buildReleaseMarker, releaseId);
  assertProductionMigrationCompatibility(production, migrationStatus);
}

export type StartupApplication = {
  init(): Promise<unknown>;
  listen(port: number): Promise<unknown>;
  close(): Promise<unknown>;
};

export async function initializeAndListenWithProductionGate(
  app: StartupApplication,
  options: {
    production: boolean;
    port: number;
    getConfigBaselineStatus: () => CloudPetConfigBaselineStatus;
    getReleaseId: () => string | null | undefined;
    getBuildReleaseMarker: () => CloudPetReleaseMarkerStatus;
    getMigrationStatus: () => PrismaMigrationCompatibilityStatus;
  }
) {
  try {
    await app.init();
    const configBaselineStatus = options.getConfigBaselineStatus();
    assertProductionConfigBaseline(options.production, configBaselineStatus);
    const releaseId = options.getReleaseId();
    assertProductionReleaseIdentity(options.production, releaseId);
    assertProductionBuildReleaseMarker(
      options.production,
      options.getBuildReleaseMarker(),
      releaseId
    );
    assertProductionMigrationCompatibility(
      options.production,
      options.getMigrationStatus()
    );
    await app.listen(options.port);
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}
