import { HttpRollingMetrics } from "./http-rolling-metrics";

describe("HttpRollingMetrics", () => {
  it("aggregates response classes in the rolling window", () => {
    const metrics = new HttpRollingMetrics(() => 300_000);
    metrics.record(200, 300_000);
    metrics.record(400, 300_001);
    metrics.record(413, 300_002);
    metrics.record(429, 300_003);
    metrics.record(500, 300_004);

    expect(metrics.snapshot(300_005)).toMatchObject({
      requestCount: 5,
      clientErrorCount: 3,
      serverErrorCount: 1,
      rateLimitedCount: 1,
      serverErrorRate: 0.2,
      scope: "process",
      windowSeconds: 300
    });
  });

  it("expires buckets outside five minutes", () => {
    const metrics = new HttpRollingMetrics(() => 0);
    metrics.record(500, 0);
    expect(metrics.snapshot(5 * 60_000)).toMatchObject({ requestCount: 0, serverErrorCount: 0 });
  });

  it("keeps a stable process start time", () => {
    const metrics = new HttpRollingMetrics(() => 1_000);
    expect(metrics.snapshot(1_000).processStartedAt).toBe(new Date(1_000).toISOString());
  });
});
