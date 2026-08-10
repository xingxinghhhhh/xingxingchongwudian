import { randomUUID } from "node:crypto";
import { NestExpressApplication } from "@nestjs/platform-express";
import {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from "express";
import { resolveApiBodyLimit } from "../config/request-body";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

type RequestWithOptionalId = Request & { requestId?: string };

function isPayloadTooLargeError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    type?: unknown;
  };

  return (
    candidate.type === "entity.too.large" &&
    (candidate.status === 413 || candidate.statusCode === 413)
  );
}

function getRequestId(request: RequestWithOptionalId, response: Response) {
  const existing = request.requestId ?? request.header("x-request-id")?.trim();
  const requestId = existing && REQUEST_ID_PATTERN.test(existing) ? existing : randomUUID();
  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  return requestId;
}

const requestBodyErrorHandler: ErrorRequestHandler = (
  error: unknown,
  request: RequestWithOptionalId,
  response: Response,
  next: NextFunction
) => {
  if (!isPayloadTooLargeError(error)) {
    next(error);
    return;
  }

  if (response.headersSent) {
    next(error);
    return;
  }

  getRequestId(request, response);
  response.status(413).json({
    statusCode: 413,
    message: "请求内容过大",
    error: "Payload Too Large",
    code: "PAYLOAD_TOO_LARGE"
  });
};

export function configureRequestBodyPolicy(
  app: NestExpressApplication,
  config: Record<string, unknown> = process.env
) {
  const limit = resolveApiBodyLimit(config);

  app.useBodyParser("json", { limit });
  app.useBodyParser("urlencoded", { limit, extended: true });
  app.use(requestBodyErrorHandler);

  return limit;
}

export { isPayloadTooLargeError };
