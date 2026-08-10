export const DEV_OPS_METRICS_TOKEN = "ops-metrics-development-token";
export const MIN_OPS_METRICS_TOKEN_LENGTH = 32;

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveOpsMetricsToken(config: Record<string, unknown> = process.env) {
  const token = readString(config, "OPS_METRICS_TOKEN");
  const isProduction = readString(config, "NODE_ENV") === "production";

  if (!token && isProduction) {
    throw new Error("OPS_METRICS_TOKEN is required in production");
  }

  if (
    token &&
    (token.length < MIN_OPS_METRICS_TOKEN_LENGTH || token === DEV_OPS_METRICS_TOKEN)
  ) {
    throw new Error(
      `OPS_METRICS_TOKEN must contain at least ${MIN_OPS_METRICS_TOKEN_LENGTH} non-default characters`
    );
  }

  return token || DEV_OPS_METRICS_TOKEN;
}
