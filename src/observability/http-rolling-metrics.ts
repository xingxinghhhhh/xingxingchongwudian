import { Inject, Injectable, Optional } from "@nestjs/common";

export const HTTP_METRICS_WINDOW_MINUTES = 5;
export const HTTP_METRICS_WINDOW_SECONDS = HTTP_METRICS_WINDOW_MINUTES * 60;
export const HTTP_METRICS_CLOCK = "HTTP_METRICS_CLOCK";

type MetricsBucket = {
  minute: number;
  requestCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  rateLimitedCount: number;
};

export type HttpRollingMetricsSnapshot = {
  scope: "process";
  windowSeconds: number;
  processStartedAt: string;
  requestCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  rateLimitedCount: number;
  serverErrorRate: number;
};

@Injectable()
export class HttpRollingMetrics {
  private readonly processStartedAt = new Date(this.clock()).toISOString();
  private readonly buckets = new Map<number, MetricsBucket>();

  constructor(
    @Optional() @Inject(HTTP_METRICS_CLOCK) private readonly clock: () => number = Date.now
  ) {}

  record(statusCode: number, atMs = this.clock()) {
    const minute = Math.floor(atMs / 60_000);
    this.prune(minute);
    const bucket = this.buckets.get(minute) ?? {
      minute,
      requestCount: 0,
      clientErrorCount: 0,
      serverErrorCount: 0,
      rateLimitedCount: 0
    };

    bucket.requestCount += 1;
    if (statusCode >= 400 && statusCode < 500) bucket.clientErrorCount += 1;
    if (statusCode === 429) bucket.rateLimitedCount += 1;
    if (statusCode >= 500) bucket.serverErrorCount += 1;
    this.buckets.set(minute, bucket);
  }

  snapshot(atMs = this.clock()): HttpRollingMetricsSnapshot {
    const minute = Math.floor(atMs / 60_000);
    this.prune(minute);
    const total = [...this.buckets.values()].reduce(
      (summary, bucket) => ({
        requestCount: summary.requestCount + bucket.requestCount,
        clientErrorCount: summary.clientErrorCount + bucket.clientErrorCount,
        serverErrorCount: summary.serverErrorCount + bucket.serverErrorCount,
        rateLimitedCount: summary.rateLimitedCount + bucket.rateLimitedCount
      }),
      { requestCount: 0, clientErrorCount: 0, serverErrorCount: 0, rateLimitedCount: 0 }
    );

    return {
      scope: "process",
      windowSeconds: HTTP_METRICS_WINDOW_SECONDS,
      processStartedAt: this.processStartedAt,
      ...total,
      serverErrorRate: total.requestCount === 0 ? 0 : total.serverErrorCount / total.requestCount
    };
  }

  private prune(currentMinute: number) {
    const oldestMinute = currentMinute - HTTP_METRICS_WINDOW_MINUTES + 1;
    for (const minute of this.buckets.keys()) {
      if (minute < oldestMinute) this.buckets.delete(minute);
    }
  }
}
