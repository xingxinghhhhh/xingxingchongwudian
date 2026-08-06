import { randomUUID } from "node:crypto";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NextFunction, Request, Response } from "express";

export type RequestWithId = Request & {
  requestId?: string;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger("HttpRequest");

  constructor(private readonly configService: ConfigService) {}

  use(request: RequestWithId, response: Response, next: NextFunction) {
    const incomingRequestId = request.header("x-request-id")?.trim();
    const requestId =
      incomingRequestId && REQUEST_ID_PATTERN.test(incomingRequestId)
        ? incomingRequestId
        : randomUUID();
    const startedAt = process.hrtime.bigint();

    request.requestId = requestId;
    response.setHeader("X-Request-Id", requestId);

    if (this.isRequestLoggingEnabled()) {
      response.once("finish", () => {
        const durationMs =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const record = JSON.stringify({
          type: "http_request",
          requestId,
          method: request.method,
          path: request.originalUrl.split("?")[0],
          statusCode: response.statusCode,
          durationMs: Math.round(durationMs * 10) / 10
        });

        if (response.statusCode >= 500) {
          this.logger.error(record);
        } else {
          this.logger.log(record);
        }
      });
    }

    next();
  }

  private isRequestLoggingEnabled() {
    return (
      this.configService.get<string>("NODE_ENV") === "production" ||
      this.configService.get<string>("REQUEST_LOGGING") === "true"
    );
  }
}
