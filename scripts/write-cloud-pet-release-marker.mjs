import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const markerPath = resolve(import.meta.dirname, "..", "dist", "cloud-pet-release.json");
const releaseId =
  typeof process.env.CLOUD_PET_RELEASE_ID === "string" &&
  process.env.CLOUD_PET_RELEASE_ID.trim().length > 0
    ? process.env.CLOUD_PET_RELEASE_ID.trim()
    : null;

await writeFile(
  markerPath,
  `${JSON.stringify({ schemaVersion: 1, releaseId }, null, 2)}\n`,
  "utf8"
);
