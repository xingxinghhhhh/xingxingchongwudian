import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { CommunityModule } from "../community/community.module";
import { DatabaseModule } from "../database/database.module";
import { CloudPetOpsMetricsService } from "./cloud-pet-ops-metrics";
import { HttpRollingMetricsMiddleware } from "./http-rolling-metrics.middleware";
import { HTTP_METRICS_CLOCK, HttpRollingMetrics } from "./http-rolling-metrics";
import { OpsMetricsAuthService } from "./ops-metrics-auth";
import { OpsMetricsController } from "./ops-metrics.controller";
import { SqliteRecoveryStatusService } from "./sqlite-recovery-status";
import { SqliteRecoveryOperationsService } from "./sqlite-recovery-operations";
import { CloudPetDeploymentReadinessService } from "./cloud-pet-deployment-readiness";
import { SqliteRecoveryAutoRefreshService } from "./sqlite-recovery-auto-refresh";
import { CloudPetLaunchReadinessService } from "./cloud-pet-launch-readiness";
import { PrismaMigrationCompatibilityService } from "./prisma-migration-compatibility";

@Module({
  imports: [CloudPetsModule, CommunityModule, DatabaseModule],
  controllers: [OpsMetricsController],
  providers: [
    CloudPetOpsMetricsService,
    { provide: HTTP_METRICS_CLOCK, useValue: Date.now },
    HttpRollingMetrics,
    HttpRollingMetricsMiddleware,
    OpsMetricsAuthService,
    SqliteRecoveryStatusService,
    SqliteRecoveryOperationsService,
    CloudPetDeploymentReadinessService,
    SqliteRecoveryAutoRefreshService,
    CloudPetLaunchReadinessService,
    PrismaMigrationCompatibilityService
  ],
  exports: [
    CloudPetOpsMetricsService,
    SqliteRecoveryStatusService,
    SqliteRecoveryOperationsService,
    CloudPetDeploymentReadinessService,
    SqliteRecoveryAutoRefreshService,
    CloudPetLaunchReadinessService,
    PrismaMigrationCompatibilityService
  ]
})
export class OpsMetricsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpRollingMetricsMiddleware).forRoutes("*");
  }
}
