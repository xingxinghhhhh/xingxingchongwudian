import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadCloudPetReleaseMarker,
  parseCloudPetReleaseMarker,
  readCloudPetReleaseMarkerFile
} from "./cloud-pet-release-marker";

describe("cloud-pet release marker", () => {
  it("reads an identified marker with the exact release id", () => {
    expect(
      parseCloudPetReleaseMarker(
        JSON.stringify({ schemaVersion: 1, releaseId: "release-2026.08" })
      )
    ).toEqual({ status: "identified", releaseId: "release-2026.08" });
  });

  it("treats a marker without a release id as missing", () => {
    expect(
      parseCloudPetReleaseMarker(JSON.stringify({ schemaVersion: 1, releaseId: null }))
    ).toEqual({ status: "missing" });
  });

  it.each([
    "not-json",
    JSON.stringify({ schemaVersion: 2, releaseId: "release-1" }),
    JSON.stringify({ schemaVersion: 1, releaseId: "release with spaces" }),
    JSON.stringify({ schemaVersion: 1, releaseId: "release-1", extra: true })
  ])("rejects an invalid marker: %s", (raw) => {
    expect(parseCloudPetReleaseMarker(raw)).toEqual({ status: "invalid" });
  });

  it("returns missing for a missing marker file without exposing filesystem errors", () => {
    const directory = mkdtempSync(join(tmpdir(), "cloud-pet-marker-"));
    try {
      expect(readCloudPetReleaseMarkerFile(join(directory, "missing.json"))).toEqual({
        status: "missing"
      });
      expect(loadCloudPetReleaseMarker()).toEqual({ status: "missing" });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reads a fixed marker file through the file loader", () => {
    const directory = mkdtempSync(join(tmpdir(), "cloud-pet-marker-"));
    const markerPath = join(directory, "cloud-pet-release.json");
    try {
      writeFileSync(
        markerPath,
        JSON.stringify({ schemaVersion: 1, releaseId: "release-from-build" }),
        "utf8"
      );
      expect(readCloudPetReleaseMarkerFile(markerPath)).toEqual({
        status: "identified",
        releaseId: "release-from-build"
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
