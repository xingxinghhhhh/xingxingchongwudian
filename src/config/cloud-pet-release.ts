export const CLOUD_PET_RELEASE_ID = "CLOUD_PET_RELEASE_ID";
export const MAX_CLOUD_PET_RELEASE_ID_LENGTH = 80;

const RELEASE_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;

function readString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCloudPetReleaseId(
  config: Record<string, unknown> = process.env
) {
  const releaseId = readString(config, CLOUD_PET_RELEASE_ID);
  if (!releaseId) return null;
  if (!RELEASE_ID_PATTERN.test(releaseId)) {
    throw new Error(
      `${CLOUD_PET_RELEASE_ID} must contain only letters, numbers, dots, underscores, or hyphens and be at most ${MAX_CLOUD_PET_RELEASE_ID_LENGTH} characters`
    );
  }
  return releaseId;
}
