import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import * as request from "supertest";
import { configureRequestBodyPolicy } from "../src/observability/request-body-policy";

describe("API request body limits", () => {
  let app: NestExpressApplication;
  const limit = 100 * 1024;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    const { AppModule } = await import("../src/app.module");

    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false
    });
    app.setGlobalPrefix("api");
    configureRequestBodyPolicy(app, { API_BODY_LIMIT_BYTES: String(limit) });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("accepts a small JSON request and preserves normal routing", async () => {
    await request(app.getHttpServer())
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ payload: "ok" }))
      .expect(404);
  });

  it("rejects an oversized JSON request with a stable 413 contract", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/health")
      .set("Content-Type", "application/json")
      .set("X-Request-Id", "body-limit-check")
      .send(JSON.stringify({ payload: "x".repeat(limit) }))
      .expect(413);

    expect(response.body).toEqual({
      statusCode: 413,
      message: "请求内容过大",
      error: "Payload Too Large",
      code: "PAYLOAD_TOO_LARGE"
    });
    expect(response.headers["x-request-id"]).toBe("body-limit-check");
  });

  it("rejects an oversized urlencoded request with the same contract", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/health")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send(`payload=${"x".repeat(limit)}`)
      .expect(413);

    expect(response.body.code).toBe("PAYLOAD_TOO_LARGE");
    expect(response.body.message).toBe("请求内容过大");
  });

  it("keeps malformed JSON separate from the payload-size error", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/health")
      .set("Content-Type", "application/json")
      .send("{invalid-json")
      .expect(400);

    expect(response.body.code).not.toBe("PAYLOAD_TOO_LARGE");
  });
});
