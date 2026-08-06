import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter } from "node:events";
import { RequestContextMiddleware, RequestWithId } from "./request-context.middleware";

function createResponse() {
  const response = new EventEmitter() as EventEmitter & {
    setHeader: jest.Mock;
    statusCode: number;
  };
  response.setHeader = jest.fn();
  response.statusCode = 200;
  return response;
}

describe("RequestContextMiddleware", () => {
  it("echoes a safe incoming request id and strips query values from logs", () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const middleware = new RequestContextMiddleware(
      new ConfigService({ REQUEST_LOGGING: "true" })
    );
    const request = {
      header: jest.fn().mockReturnValue("request-20260723"),
      method: "GET",
      originalUrl: "/api/cloud-pets?phone=13800138000"
    } as unknown as RequestWithId;
    const response = createResponse();
    const next = jest.fn();

    middleware.use(request, response as never, next);
    response.emit("finish");

    expect(request.requestId).toBe("request-20260723");
    expect(response.setHeader).toHaveBeenCalledWith(
      "X-Request-Id",
      "request-20260723"
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('"path":"/api/cloud-pets"')
    );
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("13800138000"));
    expect(next).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("replaces an unsafe request id and keeps test logging disabled", () => {
    const log = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const middleware = new RequestContextMiddleware(
      new ConfigService({ NODE_ENV: "test" })
    );
    const request = {
      header: jest.fn().mockReturnValue("unsafe id with spaces"),
      method: "GET",
      originalUrl: "/api/health"
    } as unknown as RequestWithId;
    const response = createResponse();

    middleware.use(request, response as never, jest.fn());
    response.emit("finish");

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("logs server failures at error level", () => {
    const error = jest.spyOn(Logger.prototype, "error").mockImplementation();
    const middleware = new RequestContextMiddleware(
      new ConfigService({ NODE_ENV: "production" })
    );
    const request = {
      header: jest.fn().mockReturnValue(undefined),
      method: "POST",
      originalUrl: "/api/cloud-pets"
    } as unknown as RequestWithId;
    const response = createResponse();
    response.statusCode = 500;

    middleware.use(request, response as never, jest.fn());
    response.emit("finish");

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('"statusCode":500')
    );
    error.mockRestore();
  });
});
