import {
  DEV_OPS_METRICS_TOKEN,
  resolveOpsMetricsToken
} from "./ops-metrics";

describe("resolveOpsMetricsToken", () => {
  it("uses a development fallback outside production", () => {
    expect(resolveOpsMetricsToken({ NODE_ENV: "test" })).toBe(DEV_OPS_METRICS_TOKEN);
  });

  it("requires a token in production", () => {
    expect(() => resolveOpsMetricsToken({ NODE_ENV: "production" })).toThrow(
      "OPS_METRICS_TOKEN is required in production"
    );
  });

  it("rejects short and default tokens", () => {
    expect(() =>
      resolveOpsMetricsToken({ NODE_ENV: "test", OPS_METRICS_TOKEN: "short" })
    ).toThrow("OPS_METRICS_TOKEN must contain");
    expect(() =>
      resolveOpsMetricsToken({
        NODE_ENV: "test",
        OPS_METRICS_TOKEN: DEV_OPS_METRICS_TOKEN
      })
    ).toThrow("OPS_METRICS_TOKEN must contain");
  });

  it("accepts a strong configured token", () => {
    const token = "ops-metrics-test-token-with-more-than-32-characters";
    expect(resolveOpsMetricsToken({ NODE_ENV: "production", OPS_METRICS_TOKEN: token })).toBe(
      token
    );
  });
});
