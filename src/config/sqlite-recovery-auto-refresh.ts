export const DEFAULT_SQLITE_RECOVERY_AUTO_REFRESH_ENABLED = false;

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSqliteRecoveryAutoRefreshEnabled(
  config: Record<string, unknown> = process.env
) {
  const rawValue = readString(config, "SQLITE_RECOVERY_AUTO_REFRESH_ENABLED");
  if (!rawValue) {
    return DEFAULT_SQLITE_RECOVERY_AUTO_REFRESH_ENABLED;
  }

  if (rawValue === "true") return true;
  if (rawValue === "false") return false;

  throw new Error(
    "SQLITE_RECOVERY_AUTO_REFRESH_ENABLED must be true or false"
  );
}
