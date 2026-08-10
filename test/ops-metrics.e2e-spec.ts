import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as request from "supertest";

describe("cloud-pet operations metrics", () => {
  let app: NestExpressApplication;
  const token = "ops-metrics-e2e-token-with-more-than-32-characters";

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    process.env.OPS_METRICS_TOKEN = token;
    const { AppModule } = await import("../src/app.module");

    app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects missing and invalid metrics tokens with a stable contract", async () => {
    const missing = await request(app.getHttpServer())
      .get("/api/internal/ops/cloud-pet-health")
      .expect(401);
    const invalid = await request(app.getHttpServer())
      .get("/api/internal/ops/cloud-pet-health")
      .set("X-Ops-Metrics-Token", "wrong-token")
      .expect(401);

    expect(missing.body).toMatchObject({
      statusCode: 401,
      message: "未授权访问运营指标",
      code: "OPS_METRICS_UNAUTHORIZED"
    });
    expect(invalid.body.code).toBe("OPS_METRICS_UNAUTHORIZED");
  });

  it("returns a no-store healthy cloud-pet snapshot for the valid token", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/internal/ops/cloud-pet-health")
      .set("X-Ops-Metrics-Token", token)
      .expect(200);

    expect(response.headers["cache-control"]).toContain("no-store");
    expect(response.body).toMatchObject({
      status: "healthy",
      reasons: [],
      readiness: { ready: true },
      http: { scope: "process", windowSeconds: 300 },
      cloudPet: {
        dailyDiary: { coveredCount: 0, missingCount: 0, coverageRate: 1 },
        communityModeration: { openReportCount: 0 }
      }
    });
    expect(JSON.stringify(response.body)).not.toContain(token);
  });
});
