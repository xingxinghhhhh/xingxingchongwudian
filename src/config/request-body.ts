export const DEFAULT_API_BODY_LIMIT_BYTES = 100 * 1024;
export const MIN_API_BODY_LIMIT_BYTES = 16 * 1024;
export const MAX_API_BODY_LIMIT_BYTES = 1024 * 1024;

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveApiBodyLimit(
  config: Record<string, unknown> = process.env
) {
  const rawLimit = readString(config, "API_BODY_LIMIT_BYTES");

  if (!rawLimit) {
    return DEFAULT_API_BODY_LIMIT_BYTES;
  }

  if (!/^\d+$/.test(rawLimit)) {
    throw new Error(
      `API_BODY_LIMIT_BYTES must be an integer between ${MIN_API_BODY_LIMIT_BYTES} and ${MAX_API_BODY_LIMIT_BYTES}`
    );
  }

  const limit = Number(rawLimit);
  if (
    !Number.isSafeInteger(limit) ||
    limit < MIN_API_BODY_LIMIT_BYTES ||
    limit > MAX_API_BODY_LIMIT_BYTES
  ) {
    throw new Error(
      `API_BODY_LIMIT_BYTES must be an integer between ${MIN_API_BODY_LIMIT_BYTES} and ${MAX_API_BODY_LIMIT_BYTES}`
    );
  }

  return limit;
}
