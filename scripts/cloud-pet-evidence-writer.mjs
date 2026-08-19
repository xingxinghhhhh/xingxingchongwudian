import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const schemaVersion = 1;
const releaseIdPattern = /^[A-Za-z0-9._-]{1,80}$/;
const fingerprintPattern = /^[a-f0-9]{64}$/;

function safeReleaseId(value) {
  return typeof value === "string" && releaseIdPattern.test(value.trim())
    ? value.trim()
    : "unidentified";
}

function safeFingerprint(value) {
  return typeof value === "string" && fingerprintPattern.test(value.trim())
    ? value.trim()
    : "unavailable";
}

export function createCloudPetEvidenceEnvelope({
  kind,
  ok,
  code,
  releaseId,
  configFingerprint,
  evidence
}) {
  return {
    schemaVersion,
    kind,
    ok: ok === true,
    code,
    evidence: {
      timestamp: new Date().toISOString(),
      releaseId: safeReleaseId(releaseId),
      configFingerprint: safeFingerprint(configFingerprint),
      ...evidence
    }
  };
}

export async function writeCloudPetEvidence(filePath, envelope) {
  if (!filePath) return;
  const outputPath = resolve(filePath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(envelope, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}
