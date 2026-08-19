export const CLOUD_PET_PRODUCTION_EVIDENCE_SCHEMA_VERSION = 1;
export const CLOUD_PET_PRODUCTION_GO = "CLOUD_PET_PRODUCTION_GO";
export const CLOUD_PET_PRODUCTION_NO_GO = "CLOUD_PET_PRODUCTION_NO_GO";

const RELEASE_ID_PATTERN = /^[A-Za-z0-9._-]{1,80}$/;
const CONFIG_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const DATABASE_IDENTITY_PATTERN = /^[a-f0-9]{16}$/;
const HOST_IDENTITY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const expectedCodes = {
  hostPreflight: "CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_PASSED",
  launchAcceptance: "CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED",
  coldStart: "CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED",
  warmRestart: "CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_PASSED"
} as const;

const launchStageNames = [
  "backend unit tests",
  "API E2E tests",
  "browser UI tests",
  "backend build",
  "web build",
  "production browser smoke",
  "git diff check"
] as const;

const coldStartRequiredChecks = [
  "emptyDatabaseMigrated",
  "bootstrapCreatedOneOwner",
  "duplicateBootstrapRejected",
  "liveness",
  "readiness",
  "ownerLogin",
  "memberLogin",
  "cloudPetCreated",
  "careTaskCompleted",
  "careDiaryVisible"
] as const;

const warmRestartRequiredChecks = [
  "migratedFreshDatabase",
  "bootstrapCreatedOneOwner",
  "duplicateBootstrapRejected",
  "runtimeAReady",
  "runtimeAGracefullyStopped",
  "ownershipReleasedBeforeRuntimeB",
  "runtimeBReadyOnSameDatabase",
  "ownerLoginBeforeAndAfterRestart",
  "memberPetAndDiaryPersisted"
] as const;

type EvidenceRecord = Record<string, unknown>;

export type CloudPetProductionEvidencePacket = {
  schemaVersion: 1;
  candidate: {
    releaseId: string;
    configFingerprint: string;
  };
  target: {
    hostIdentity: string;
    databaseIdentity: string;
  };
  evidence: {
    hostPreflight: EvidenceRecord;
    launchAcceptance: EvidenceRecord;
    coldStart: EvidenceRecord;
    warmRestart: EvidenceRecord;
  };
};

export type CloudPetProductionGoNoGoResult = {
  ok: boolean;
  code: typeof CLOUD_PET_PRODUCTION_GO | typeof CLOUD_PET_PRODUCTION_NO_GO;
  evidence: {
    schemaVersion: 1;
    candidate: CloudPetProductionEvidencePacket["candidate"];
    target: CloudPetProductionEvidencePacket["target"];
    checks: Record<keyof CloudPetProductionEvidencePacket["evidence"], "passed" | "failed">;
    failures: Array<{ check: string; reason: string }>;
  };
};

function isRecord(value: unknown): value is EvidenceRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: EvidenceRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readBoolean(record: EvidenceRecord, key: string) {
  return record[key] === true;
}

function readNestedRecord(record: EvidenceRecord, key: string) {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function addFailure(
  failures: Array<{ check: string; reason: string }>,
  check: string,
  reason: string
) {
  failures.push({ check, reason });
}

function isSafeTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function hasSensitiveKey(key: string) {
  if (key === "runtimeOwnerSecretsPresent") return false;
  return /password|secret|token|cookie|session|credential|authorization|databaseurl|webhook/i.test(
    key
  );
}

function findSensitiveKey(value: unknown, path = ""): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found: string | null = findSensitiveKey(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;
    if (hasSensitiveKey(key)) return childPath;
    const found: string | null = findSensitiveKey(child, childPath);
    if (found) return found;
  }
  return null;
}

function validateCandidate(
  packet: EvidenceRecord,
  failures: Array<{ check: string; reason: string }>
) {
  const candidate = readNestedRecord(packet, "candidate");
  const target = readNestedRecord(packet, "target");
  const releaseId = candidate && readString(candidate, "releaseId");
  const configFingerprint = candidate && readString(candidate, "configFingerprint");
  const hostIdentity = target && readString(target, "hostIdentity");
  const databaseIdentity = target && readString(target, "databaseIdentity");

  if (!releaseId || !RELEASE_ID_PATTERN.test(releaseId)) {
    addFailure(failures, "candidate", "RELEASE_ID_INVALID");
  }
  if (!configFingerprint || !CONFIG_FINGERPRINT_PATTERN.test(configFingerprint)) {
    addFailure(failures, "candidate", "CONFIG_FINGERPRINT_INVALID");
  }
  if (!hostIdentity || !HOST_IDENTITY_PATTERN.test(hostIdentity)) {
    addFailure(failures, "target", "HOST_IDENTITY_INVALID");
  }
  if (!databaseIdentity || !DATABASE_IDENTITY_PATTERN.test(databaseIdentity)) {
    addFailure(failures, "target", "DATABASE_IDENTITY_INVALID");
  }

  return {
    releaseId,
    configFingerprint,
    hostIdentity,
    databaseIdentity
  };
}

function validateCommonEvidence(
  record: EvidenceRecord | null,
  check: keyof typeof expectedCodes,
  candidate: ReturnType<typeof validateCandidate>,
  failures: Array<{ check: string; reason: string }>
) {
  if (!record) {
    addFailure(failures, check, "EVIDENCE_MISSING");
    return false;
  }
  if (record.ok !== true || readString(record, "code") !== expectedCodes[check]) {
    addFailure(failures, check, "CHECK_NOT_PASSED");
  }
  if (!isSafeTimestamp(record.timestamp)) {
    addFailure(failures, check, "TIMESTAMP_INVALID");
  }
  if (candidate.releaseId && readString(record, "releaseId") !== candidate.releaseId) {
    addFailure(failures, check, "RELEASE_ID_MISMATCH");
  }
  if (
    candidate.configFingerprint &&
    readString(record, "configFingerprint") !== candidate.configFingerprint
  ) {
    addFailure(failures, check, "CONFIG_FINGERPRINT_MISMATCH");
  }
  return true;
}

function validateHostPreflight(
  record: EvidenceRecord | null,
  candidate: ReturnType<typeof validateCandidate>,
  failures: Array<{ check: string; reason: string }>
) {
  if (!validateCommonEvidence(record, "hostPreflight", candidate, failures) || !record) {
    return;
  }
  if (readString(record, "configBaseline") !== "matched") {
    addFailure(failures, "hostPreflight", "SAFE_CONFIG_BASELINE_NOT_MATCHED");
  }
  if (readString(record, "migrationCompatibility") !== "compatible") {
    addFailure(failures, "hostPreflight", "MIGRATION_NOT_COMPATIBLE");
  }
  if (readString(record, "databaseIdentity") !== candidate.databaseIdentity) {
    addFailure(failures, "hostPreflight", "DATABASE_IDENTITY_MISMATCH");
  }
  if (!readBoolean(record, "portsAvailable")) {
    addFailure(failures, "hostPreflight", "PORTS_NOT_AVAILABLE");
  }
  if (record.failures !== undefined && (!Array.isArray(record.failures) || record.failures.length > 0)) {
    addFailure(failures, "hostPreflight", "PREFLIGHT_FAILURES_PRESENT");
  }
}

function validateLaunchAcceptance(
  record: EvidenceRecord | null,
  candidate: ReturnType<typeof validateCandidate>,
  failures: Array<{ check: string; reason: string }>
) {
  if (!validateCommonEvidence(record, "launchAcceptance", candidate, failures) || !record) {
    return;
  }
  const stageResults = record.stageResults;
  if (!Array.isArray(stageResults)) {
    addFailure(failures, "launchAcceptance", "STAGE_RESULTS_MISSING");
    return;
  }
  for (const stageName of launchStageNames) {
    const stage = stageResults.find((value) => isRecord(value) && value.name === stageName);
    if (!stage || stage.status !== "passed") {
      addFailure(failures, "launchAcceptance", `STAGE_NOT_PASSED:${stageName}`);
    }
  }
}

function validateDrill(
  record: EvidenceRecord | null,
  check: "coldStart" | "warmRestart",
  requiredChecks: readonly string[],
  candidate: ReturnType<typeof validateCandidate>,
  failures: Array<{ check: string; reason: string }>
) {
  if (!validateCommonEvidence(record, check, candidate, failures) || !record) return;
  const checks = readNestedRecord(record, "checks");
  if (!checks) {
    addFailure(failures, check, "DRILL_CHECKS_MISSING");
    return;
  }
  if (checks.runtimeOwnerSecretsPresent !== false) {
    addFailure(failures, check, "RUNTIME_OWNER_SECRETS_PRESENT");
  }
  for (const requiredCheck of requiredChecks) {
    if (checks[requiredCheck] !== true) {
      addFailure(failures, check, `DRILL_CHECK_NOT_PASSED:${requiredCheck}`);
    }
  }
}

export function evaluateCloudPetProductionEvidence(
  input: unknown
): CloudPetProductionGoNoGoResult {
  const failures: Array<{ check: string; reason: string }> = [];
  const packet = isRecord(input) ? input : null;
  if (!packet) {
    addFailure(failures, "packet", "PACKET_NOT_OBJECT");
  }
  if (packet?.schemaVersion !== CLOUD_PET_PRODUCTION_EVIDENCE_SCHEMA_VERSION) {
    addFailure(failures, "packet", "SCHEMA_VERSION_UNSUPPORTED");
  }
  const sensitivePath = findSensitiveKey(input);
  if (sensitivePath) addFailure(failures, "packet", "SENSITIVE_FIELD_PRESENT");

  const candidate = validateCandidate(packet ?? {}, failures);
  const evidence = packet && readNestedRecord(packet, "evidence");
  const hostPreflight = evidence && readNestedRecord(evidence, "hostPreflight");
  const launchAcceptance = evidence && readNestedRecord(evidence, "launchAcceptance");
  const coldStart = evidence && readNestedRecord(evidence, "coldStart");
  const warmRestart = evidence && readNestedRecord(evidence, "warmRestart");

  validateHostPreflight(hostPreflight, candidate, failures);
  validateLaunchAcceptance(launchAcceptance, candidate, failures);
  validateDrill(coldStart, "coldStart", coldStartRequiredChecks, candidate, failures);
  validateDrill(warmRestart, "warmRestart", warmRestartRequiredChecks, candidate, failures);

  const result = failures.length === 0;
  return {
    ok: result,
    code: result ? CLOUD_PET_PRODUCTION_GO : CLOUD_PET_PRODUCTION_NO_GO,
    evidence: {
      schemaVersion: CLOUD_PET_PRODUCTION_EVIDENCE_SCHEMA_VERSION,
      candidate: {
        releaseId: candidate.releaseId ?? "unidentified",
        configFingerprint: candidate.configFingerprint ?? "unavailable"
      },
      target: {
        hostIdentity: candidate.hostIdentity ?? "unidentified",
        databaseIdentity: candidate.databaseIdentity ?? "unavailable"
      },
      checks: {
        hostPreflight: failures.some(({ check }) => check === "hostPreflight") ? "failed" : "passed",
        launchAcceptance: failures.some(({ check }) => check === "launchAcceptance") ? "failed" : "passed",
        coldStart: failures.some(({ check }) => check === "coldStart") ? "failed" : "passed",
        warmRestart: failures.some(({ check }) => check === "warmRestart") ? "failed" : "passed"
      },
      failures
    }
  };
}
