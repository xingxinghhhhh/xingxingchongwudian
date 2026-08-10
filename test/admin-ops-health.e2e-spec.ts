import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

describe("admin cloud-pet operations health", () => {
  let app: INestApplication;

  async function loginAsAdmin(role: "owner" | "operator") {
    const credentials = {
      owner: { email: "owner@example.com", password: "owner123456" },
      operator: { email: "operator@example.com", password: "operator123456" }
    }[role];

    const response = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send(credentials)
      .expect(201);

    return response.body.sessionToken as string;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    process.env.KZT_USE_MEMORY_STORE = "true";
    const { AppModule } = await import("../src/app.module");
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires an admin session and owner permission", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-health")
      .expect(401);

    const operatorSession = await loginAsAdmin("operator");
    await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-health")
      .set("X-Admin-Session", operatorSession)
      .expect(403);
  });

  it("returns the safe health projection to an owner", async () => {
    const ownerSession = await loginAsAdmin("owner");
    const response = await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-health")
      .set("X-Admin-Session", ownerSession)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({
      status: "healthy",
      readiness: { ready: true },
      http: { scope: "process", windowSeconds: 300 },
      cloudPet: {
        dailyDiary: { coveredCount: 0, missingCount: 0, coverageRate: 1 },
        communityModeration: { openReportCount: 0 }
      }
    });
    expect(response.body.readiness.database).toBeUndefined();
    expect(response.body.http.processStartedAt).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain("OPS_METRICS_TOKEN");
  });

  it("returns deployment readiness only to an owner", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/ops/deployment-readiness")
      .expect(401);

    const operatorSession = await loginAsAdmin("operator");
    await request(app.getHttpServer())
      .get("/api/admin/ops/deployment-readiness")
      .set("X-Admin-Session", operatorSession)
      .expect(403);

    const ownerSession = await loginAsAdmin("owner");
    const response = await request(app.getHttpServer())
      .get("/api/admin/ops/deployment-readiness")
      .set("X-Admin-Session", ownerSession)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({
      status: "attention",
      runtime: { production: false },
      persistence: { mode: "memory", databaseReady: false },
      configBaseline: { status: "unconfigured" },
      release: { status: "unidentified", id: null },
      migrationCompatibility: { status: "unavailable" },
      configuration: {
        recoveryStatusDirectoryConfigured: false
      }
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("OPS_METRICS_TOKEN");
    expect(serialized).not.toContain("MEMBER_AUTH_WEBHOOK_TOKEN");
    expect(serialized).not.toContain("_prisma_migrations");
    expect(serialized).not.toContain("checksum");
    expect(serialized).not.toContain("stack");
  });

  it("returns the safe launch readiness projection only to an owner", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-launch-readiness")
      .expect(401);

    const operatorSession = await loginAsAdmin("operator");
    await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-launch-readiness")
      .set("X-Admin-Session", operatorSession)
      .expect(403);

    const ownerSession = await loginAsAdmin("owner");
    const response = await request(app.getHttpServer())
      .get("/api/admin/ops/cloud-pet-launch-readiness")
      .set("X-Admin-Session", ownerSession)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({
      status: "needs_attention",
      checks: {
        runtime: "failed",
        dataProtection: "failed",
        automation: "passed"
      },
      attentionItems: [
        { code: "API_NOT_READY" },
        { code: "RECOVERY_NOT_VERIFIED" }
      ]
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("DATABASE_URL");
    expect(serialized).not.toContain("OPS_METRICS_TOKEN");
    expect(serialized).not.toContain("processStartedAt");
    expect(serialized).not.toContain("stack");
  });

  it("exposes SQLite recovery status only to an owner", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/ops/sqlite-recovery-status")
      .expect(401);

    const operatorSession = await loginAsAdmin("operator");
    await request(app.getHttpServer())
      .get("/api/admin/ops/sqlite-recovery-status")
      .set("X-Admin-Session", operatorSession)
      .expect(403);

    const ownerSession = await loginAsAdmin("owner");
    const response = await request(app.getHttpServer())
      .get("/api/admin/ops/sqlite-recovery-status")
      .set("X-Admin-Session", ownerSession)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toEqual({
      status: "unavailable",
      freshness: "unknown",
      autoRefreshEnabled: false,
      autoRefreshRuntime: {
        lastCheckedAt: null,
        lastOutcome: "not_run_yet",
        reasonCode: null,
        suppressionActive: false,
        nextCheckAt: null
      }
    });

    await request(app.getHttpServer())
      .post("/api/admin/ops/sqlite-recovery/run")
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/admin/ops/sqlite-recovery/run")
      .set("X-Admin-Session", operatorSession)
      .expect(403);

    const unconfigured = await request(app.getHttpServer())
      .post("/api/admin/ops/sqlite-recovery/run")
      .set("X-Admin-Session", ownerSession)
      .expect(400);
    expect(unconfigured.body).toMatchObject({
      code: "SQLITE_RECOVERY_STATUS_DIR_REQUIRED"
    });
  });
});
