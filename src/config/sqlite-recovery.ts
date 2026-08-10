export const DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS = 24;
export const MIN_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS = 1;
export const MAX_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS = 720;

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveSqliteRecoveryMaxBackupAgeHours(
  config: Record<string, unknown> = process.env
) {
  const rawValue = readString(config, "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS");
  if (!rawValue) {
    return DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(
      "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS must be an integer between 1 and 720"
    );
  }

  const hours = Number(rawValue);
  if (
    !Number.isSafeInteger(hours) ||
    hours < MIN_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS ||
    hours > MAX_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS
  ) {
    throw new Error(
      "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS must be an integer between 1 and 720"
    );
  }

  return hours;
}
