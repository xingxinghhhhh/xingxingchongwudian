import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CLOUD_PET_RELEASE_ID,
  resolveCloudPetReleaseId
} from "./cloud-pet-release";

export const CLOUD_PET_RELEASE_MARKER_SCHEMA_VERSION = 1 as const;
export const CLOUD_PET_RELEASE_MARKER_FILE = "cloud-pet-release.json";

export type CloudPetReleaseMarkerStatus =
  | { status: "identified"; releaseId: string }
  | { status: "missing" }
  | { status: "invalid" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCloudPetReleaseMarker(raw: string): CloudPetReleaseMarkerStatus {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return { status: "invalid" };

    const keys = Object.keys(parsed).sort();
    if (
      keys.length !== 2 ||
      keys[0] !== "releaseId" ||
      keys[1] !== "schemaVersion" ||
      parsed.schemaVersion !== CLOUD_PET_RELEASE_MARKER_SCHEMA_VERSION
    ) {
      return { status: "invalid" };
    }

    if (parsed.releaseId === null) return { status: "missing" };
    if (typeof parsed.releaseId !== "string") return { status: "invalid" };

    const releaseId = resolveCloudPetReleaseId({
      [CLOUD_PET_RELEASE_ID]: parsed.releaseId
    });
    return releaseId ? { status: "identified", releaseId } : { status: "missing" };
  } catch {
    return { status: "invalid" };
  }
}

export function readCloudPetReleaseMarkerFile(
  markerPath: string
): CloudPetReleaseMarkerStatus {
  try {
    return parseCloudPetReleaseMarker(readFileSync(markerPath, "utf8"));
  } catch {
    return { status: "missing" };
  }
}

export function loadCloudPetReleaseMarker(): CloudPetReleaseMarkerStatus {
  return readCloudPetReleaseMarkerFile(
    resolve(__dirname, "..", CLOUD_PET_RELEASE_MARKER_FILE)
  );
}
