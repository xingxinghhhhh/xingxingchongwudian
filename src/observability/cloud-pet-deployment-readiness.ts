import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseHealthService } from "../database/database-health.service";
import { resolveApiBodyLimit } from "../config/request-body";
import { getCloudPetConfigBaselineStatus } from "../config/cloud-pet-config-fingerprint";
import { CLOUD_PET_RELEASE_ID, resolveCloudPetReleaseId } from "../config/cloud-pet-release";
import { PrismaMigrationCompatibilityService } from "./prisma-migration-compatibility";

export type CloudPetDeploymentReadiness = {
  status: "ready" | "attention";
  runtime: {
    production: boolean;
  };
  persistence: {
    mode: "prisma_sqlite" | "memory" | "unknown";
    databaseReady: boolean;
  };
  configuration: {
    adminAuthConfigured: boolean;
    memberWebhookConfigured: boolean;
    corsConfigured: boolean;
    trustedProxyConfigured: boolean;
    requestBodyLimitConfigured: boolean;
    opsMetricsConfigured: boolean;
    recoveryStatusDirectoryConfigured: boolean;
  };
  configBaseline: {
    status: "matched" | "unconfigured" | "mismatch";
  };
  release: {
    status: "identified" | "unidentified";
    id: string | null;
  };
  migrationCompatibility: {
    status: "compatible" | "mismatch" | "unavailable";
  };
};

function isConfigured(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

@Injectable()
export class CloudPetDeploymentReadinessService {
  constructor(
    private readonly configService: ConfigService,
    private readonly databaseHealthService: DatabaseHealthService,
    @Optional()
    private readonly migrationCompatibilityService?: PrismaMigrationCompatibilityService
  ) {}

  async getReadiness(): Promise<CloudPetDeploymentReadiness> {
    const databaseStatus = this.databaseHealthService.getStatus();
    const databaseReadiness = await this.databaseHealthService.checkReadiness();
    const persistenceMode =
      databaseStatus.mode === "database"
        ? "prisma_sqlite"
        : databaseStatus.mode === "memory"
          ? "memory"
          : "unknown";
    const configuration = this.getConfigurationStatus();
    const configBaseline = {
      status: getCloudPetConfigBaselineStatus(this.configService)
    } as const;
    const releaseId = resolveCloudPetReleaseId({
      [CLOUD_PET_RELEASE_ID]: this.configService.get<string>(CLOUD_PET_RELEASE_ID)
    });
    const databaseReady =
      persistenceMode === "prisma_sqlite" &&
      databaseReadiness.ready &&
      databaseReadiness.database.connected === true;
    const production = this.configService.get<string>("NODE_ENV") === "production";
    const requiredConfigurationReady =
      configuration.adminAuthConfigured &&
      configuration.memberWebhookConfigured &&
      configuration.corsConfigured &&
      configuration.trustedProxyConfigured &&
      configuration.requestBodyLimitConfigured &&
      configuration.opsMetricsConfigured;

    return {
      status:
        production &&
        persistenceMode === "prisma_sqlite" &&
        databaseReady &&
        requiredConfigurationReady
          ? "ready"
          : "attention",
      runtime: { production },
      persistence: {
        mode: persistenceMode,
        databaseReady
      },
      configuration,
      configBaseline,
      release: {
        status: releaseId ? "identified" : "unidentified",
        id: releaseId
      },
      migrationCompatibility: this.migrationCompatibilityService?.getStatus() ?? {
        status: "unavailable"
      }
    };
  }

  private getConfigurationStatus() {
    const memberAuthProvider = this.configService.get<string>("MEMBER_AUTH_PROVIDER");
    const requestBodyLimitConfigured = (() => {
      try {
        resolveApiBodyLimit({
          API_BODY_LIMIT_BYTES: this.configService.get<string>("API_BODY_LIMIT_BYTES")
        });
        return true;
      } catch {
        return false;
      }
    })();

    return {
      adminAuthConfigured:
        isConfigured(this.configService.get<string>("ADMIN_API_KEY")) &&
        isConfigured(this.configService.get<string>("ADMIN_OWNER_EMAIL")) &&
        isConfigured(this.configService.get<string>("ADMIN_OWNER_PASSWORD")),
      memberWebhookConfigured:
        memberAuthProvider === "webhook" &&
        isConfigured(this.configService.get<string>("MEMBER_AUTH_CODE_SECRET")) &&
        isConfigured(this.configService.get<string>("MEMBER_AUTH_WEBHOOK_URL")) &&
        isConfigured(this.configService.get<string>("MEMBER_AUTH_WEBHOOK_TOKEN")),
      corsConfigured: isConfigured(this.configService.get<string>("WEB_ORIGIN")),
      trustedProxyConfigured: isConfigured(
        this.configService.get<string>("TRUST_PROXY_HOPS")
      ),
      requestBodyLimitConfigured,
      opsMetricsConfigured: isConfigured(
        this.configService.get<string>("OPS_METRICS_TOKEN")
      ),
      recoveryStatusDirectoryConfigured: isConfigured(
        this.configService.get<string>("SQLITE_RECOVERY_STATUS_DIR")
      )
    };
  }
}
