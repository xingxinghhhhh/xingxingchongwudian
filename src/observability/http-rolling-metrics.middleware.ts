import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { HttpRollingMetrics } from "./http-rolling-metrics";

@Injectable()
export class HttpRollingMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: HttpRollingMetrics) {}

  use(_request: Request, response: Response, next: NextFunction) {
    response.once("finish", () => {
      try {
        this.metrics.record(response.statusCode);
      } catch {
        // Metrics must never affect the request lifecycle.
      }
    });
    next();
  }
}
