import {
  CLOUD_PET_PRODUCTION_GO,
  CLOUD_PET_PRODUCTION_NO_GO,
  evaluateCloudPetProductionEvidence
} from "./cloud-pet-production-go-no-go";

const releaseId = "cloud-pet-production-2026-08-19";
const configFingerprint = "a".repeat(64);
const databaseIdentity = "b".repeat(16);
const timestamp = "2026-08-19T12:00:00.000Z";

function makePacket() {
  const common = { ok: true, releaseId, configFingerprint, timestamp };
  return {
    schemaVersion: 1,
    candidate: { releaseId, configFingerprint },
    target: { hostIdentity: "production-host-01", databaseIdentity },
    evidence: {
      hostPreflight: {
        ...common,
        code: "CLOUD_PET_PRODUCTION_HOST_PREFLIGHT_PASSED",
        configBaseline: "matched",
        migrationCompatibility: "compatible",
        databaseIdentity,
        portsAvailable: true,
        failures: []
      },
      launchAcceptance: {
        ...common,
        code: "CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED",
        stageResults: [
          "backend unit tests",
          "API E2E tests",
          "browser UI tests",
          "backend build",
          "web build",
          "production browser smoke",
          "git diff check"
        ].map((name) => ({ name, status: "passed" }))
      },
      coldStart: {
        ...common,
        code: "CLOUD_PET_COLD_START_HANDOVER_DRILL_PASSED",
        checks: {
          emptyDatabaseMigrated: true,
          bootstrapCreatedOneOwner: true,
          duplicateBootstrapRejected: true,
          runtimeOwnerSecretsPresent: false,
          liveness: true,
          readiness: true,
          ownerLogin: true,
          memberLogin: true,
          cloudPetCreated: true,
          careTaskCompleted: true,
          careDiaryVisible: true
        }
      },
      warmRestart: {
        ...common,
        code: "CLOUD_PET_WARM_RESTART_HANDOVER_DRILL_PASSED",
        checks: {
          migratedFreshDatabase: true,
          bootstrapCreatedOneOwner: true,
          duplicateBootstrapRejected: true,
          runtimeOwnerSecretsPresent: false,
          runtimeAReady: true,
          runtimeAGracefullyStopped: true,
          ownershipReleasedBeforeRuntimeB: true,
          runtimeBReadyOnSameDatabase: true,
          ownerLoginBeforeAndAfterRestart: true,
          memberPetAndDiaryPersisted: true
        }
      }
    }
  };
}

describe("cloud pet production GO/NO-GO evidence", () => {
  it("returns GO only when all evidence belongs to the same candidate", () => {
    const result = evaluateCloudPetProductionEvidence(makePacket());

    expect(result).toMatchObject({ ok: true, code: CLOUD_PET_PRODUCTION_GO });
    expect(result.evidence.failures).toEqual([]);
  });

  it.each([
    ["host preflight missing", (packet: ReturnType<typeof makePacket>) => { (packet.evidence as Record<string, unknown>).hostPreflight = undefined; }],
    ["host preflight failed", (packet: ReturnType<typeof makePacket>) => { packet.evidence.hostPreflight.ok = false; }],
    ["launch acceptance missing", (packet: ReturnType<typeof makePacket>) => { (packet.evidence as Record<string, unknown>).launchAcceptance = undefined; }],
    ["cold-start missing", (packet: ReturnType<typeof makePacket>) => { (packet.evidence as Record<string, unknown>).coldStart = undefined; }],
    ["warm-restart missing", (packet: ReturnType<typeof makePacket>) => { (packet.evidence as Record<string, unknown>).warmRestart = undefined; }]
  ])("returns NO-GO when %s", (_label, mutate) => {
    const packet = makePacket();
    mutate(packet);

    const result = evaluateCloudPetProductionEvidence(packet);

    expect(result).toMatchObject({ ok: false, code: CLOUD_PET_PRODUCTION_NO_GO });
  });

  it("rejects mixed release identities and configuration fingerprints", () => {
    const packet = makePacket();
    packet.evidence.warmRestart.releaseId = "another-release";
    packet.evidence.coldStart.configFingerprint = "c".repeat(64);

    const result = evaluateCloudPetProductionEvidence(packet);

    expect(result.evidence.failures).toEqual(
      expect.arrayContaining([
        { check: "warmRestart", reason: "RELEASE_ID_MISMATCH" },
        { check: "coldStart", reason: "CONFIG_FINGERPRINT_MISMATCH" }
      ])
    );
  });

  it("rejects an unsafe evidence packet without echoing sensitive data", () => {
    const packet = makePacket() as Record<string, unknown>;
    (packet.evidence as Record<string, unknown>).launchAcceptance = {
      password: "do-not-echo",
      ok: true
    };

    const result = evaluateCloudPetProductionEvidence(packet);

    expect(result.ok).toBe(false);
    expect(result.evidence.failures).toContainEqual({
      check: "packet",
      reason: "SENSITIVE_FIELD_PRESENT"
    });
    expect(JSON.stringify(result)).not.toContain("do-not-echo");
  });

  it("rejects a failed drill check and runtime owner secrets", () => {
    const packet = makePacket();
    packet.evidence.coldStart.checks.careDiaryVisible = false;
    packet.evidence.warmRestart.checks.runtimeOwnerSecretsPresent = true;

    const result = evaluateCloudPetProductionEvidence(packet);

    expect(result.evidence.failures).toEqual(
      expect.arrayContaining([
        { check: "coldStart", reason: "DRILL_CHECK_NOT_PASSED:careDiaryVisible" },
        { check: "warmRestart", reason: "RUNTIME_OWNER_SECRETS_PRESENT" }
      ])
    );
  });
});
