import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { configureRequestBodyPolicy } from "./observability/request-body-policy";
import { configureTrustProxy } from "./config/trust-proxy";
import { getCloudPetConfigBaselineStatus } from "./config/cloud-pet-config-fingerprint";
import { CLOUD_PET_RELEASE_ID } from "./config/cloud-pet-release";
import { loadCloudPetReleaseMarker } from "./config/cloud-pet-release-marker";
import {
  initializeAndListenWithProductionGate,
  ProductionStartupGateError
} from "./config/production-startup-gate";
import { PrismaMigrationCompatibilityService } from "./observability/prisma-migration-compatibility";
import {
  acquireProductionSqliteRuntimeOwnership,
  SqliteRuntimeOwnershipError
} from "./config/sqlite-runtime-ownership";

function installManagedShutdownControl(
  app: NestExpressApplication
) {
  if (
    process.env.KZT_ENABLE_PROCESS_SHUTDOWN_CONTROL !== "true" ||
    typeof process.send !== "function"
  ) {
    return;
  }

  process.once("message", async (message) => {
    if (message !== "kzt:graceful-shutdown") {
      return;
    }

    try {
      await app.close();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  });
}

async function bootstrap() {
  const runtimeOwnership = acquireProductionSqliteRuntimeOwnership({
    production: process.env.NODE_ENV === "production",
    databaseUrl: process.env.DATABASE_URL,
    useMemoryStore: process.env.KZT_USE_MEMORY_STORE
  });
  runtimeOwnership.installProcessShutdownHooks();

  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false
    });

    configureTrustProxy(app);
    app.use(
      helmet({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
      })
    );
    configureRequestBodyPolicy(app);
    app.setGlobalPrefix("api");
    app.enableCors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3001",
      exposedHeaders: ["X-Request-Id"]
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true
      })
    );
    app.enableShutdownHooks();
    installManagedShutdownControl(app);

    const port = Number(process.env.PORT ?? 3000);
    await initializeAndListenWithProductionGate(app, {
      production: process.env.NODE_ENV === "production",
      port,
      getConfigBaselineStatus: () =>
        getCloudPetConfigBaselineStatus(process.env),
      getReleaseId: () =>
        app.get(ConfigService).get<string>(CLOUD_PET_RELEASE_ID),
      getBuildReleaseMarker: () => loadCloudPetReleaseMarker(),
      getMigrationStatus: () =>
        app
          .get(PrismaMigrationCompatibilityService, { strict: false })
          .getStatus().status
    });
  } catch (error) {
    runtimeOwnership.release();
    throw error;
  }
}

void bootstrap().catch((error) => {
  if (error instanceof SqliteRuntimeOwnershipError) {
    console.error(
      JSON.stringify({
        event: "production_startup_blocked",
        reasonCode: error.code
      })
    );
  } else if (error instanceof ProductionStartupGateError) {
    console.error(
      JSON.stringify({
        event: "production_startup_blocked",
        reasonCode: error.code,
        ...(error.configBaselineStatus
          ? { configBaselineStatus: error.configBaselineStatus }
          : {}),
        ...(error.releaseStatus
          ? { releaseStatus: error.releaseStatus }
          : {}),
        ...(error.buildMarkerStatus
          ? { buildMarkerStatus: error.buildMarkerStatus }
          : {}),
        ...(error.migrationStatus
          ? { migrationStatus: error.migrationStatus }
          : {})
      })
    );
  } else {
    console.error("Application failed to start");
  }
  process.exitCode = 1;
});
