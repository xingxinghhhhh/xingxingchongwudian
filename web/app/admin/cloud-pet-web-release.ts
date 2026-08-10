export type CloudPetWebRelease = {
  status: "identified" | "unidentified";
  id: string | null;
};

export type CloudPetWebApiReleaseMatch =
  | "matched"
  | "mismatch"
  | "unidentified";

export type CloudPetWebReleaseAttentionCode =
  | "WEB_RELEASE_UNIDENTIFIED"
  | "WEB_API_RELEASE_MISMATCH";

export function resolveCloudPetWebRelease(value: unknown): CloudPetWebRelease {
  const id = typeof value === "string" ? value.trim() : "";
  return id ? { status: "identified", id } : { status: "unidentified", id: null };
}

export function getCloudPetWebRelease(): CloudPetWebRelease {
  return resolveCloudPetWebRelease(
    process.env.NEXT_PUBLIC_CLOUD_PET_WEB_RELEASE_ID
  );
}

export function compareCloudPetWebApiRelease(
  webRelease: CloudPetWebRelease,
  apiRelease: { status: "identified" | "unidentified"; id: string | null }
): CloudPetWebApiReleaseMatch {
  if (
    webRelease.status !== "identified" ||
    apiRelease.status !== "identified" ||
    !webRelease.id ||
    !apiRelease.id
  ) {
    return "unidentified";
  }
  return webRelease.id === apiRelease.id ? "matched" : "mismatch";
}

export function getCloudPetWebReleaseAttention(
  webRelease: CloudPetWebRelease,
  apiRelease: { status: "identified" | "unidentified"; id: string | null }
): CloudPetWebReleaseAttentionCode[] {
  if (apiRelease.status !== "identified" || !apiRelease.id) return [];
  if (webRelease.status !== "identified" || !webRelease.id) {
    return ["WEB_RELEASE_UNIDENTIFIED"];
  }
  return webRelease.id === apiRelease.id ? [] : ["WEB_API_RELEASE_MISMATCH"];
}

export function getCloudPetEffectiveLaunchStatus(
  backendStatus: "passed" | "needs_attention",
  webAttention: CloudPetWebReleaseAttentionCode[]
) {
  return backendStatus === "needs_attention" || webAttention.length > 0
    ? "needs_attention"
    : "passed";
}
