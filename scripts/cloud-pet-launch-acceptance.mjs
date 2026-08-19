import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createCloudPetEvidenceEnvelope, writeCloudPetEvidence } from "./cloud-pet-evidence-writer.mjs";

const rootDir = resolve(import.meta.dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const stages = [
  { name: "backend unit tests", command: npmCommand, args: ["test", "--", "--runInBand"] },
  { name: "API E2E tests", command: npmCommand, args: ["run", "test:e2e", "--", "--runInBand"] },
  { name: "browser UI tests", command: npmCommand, args: ["run", "test:ui", "--", "--workers=1"] },
  { name: "backend build", command: npmCommand, args: ["run", "build"] },
  { name: "web build", command: npmCommand, args: ["run", "web:build"] },
  {
    name: "production browser smoke",
    command: npmCommand,
    args: ["run", "smoke:cloud-pet-web-production"]
  },
  { name: "git diff check", command: "git", args: ["diff", "--check"] }
];

function tail(text, maxLength = 1_600) {
  const normalized = text.trim();
  return normalized.length > maxLength ? normalized.slice(-maxLength) : normalized;
}

function runStage(stage) {
  return new Promise((resolve, reject) => {
    const child = spawn(stage.command, stage.args, {
      cwd: rootDir,
      env: process.env,
      shell: process.platform === "win32",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk.toString()}`.slice(-8_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-8_000);
    });
    child.once("error", (error) => reject(error));
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const detail = tail(stderr || stdout || `exit=${code ?? "unknown"}, signal=${signal ?? "none"}`);
      reject(new Error(detail));
    });
  });
}

async function main() {
  const stageResults = [];
  for (const stage of stages) {
    console.log(`[cloud-pet-launch] START ${stage.name}`);
    try {
      const result = await runStage(stage);
      const summary = tail(result.stdout || result.stderr, 320).split("\n").filter(Boolean).at(-1);
      stageResults.push({ name: stage.name, status: "passed" });
      console.log(`[cloud-pet-launch] PASS ${stage.name}${summary ? `: ${summary}` : ""}`);
    } catch (error) {
      stageResults.push({ name: stage.name, status: "failed" });
      await writeLaunchEvidence(false, "CLOUD_PET_LAUNCH_ACCEPTANCE_FAILED", stageResults);
      console.error(`[cloud-pet-launch] FAIL ${stage.name}`);
      console.error(tail(error instanceof Error ? error.message : String(error)));
      process.exitCode = 1;
      return;
    }
  }

  await writeLaunchEvidence(true, "CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED", stageResults);
  console.log("CLOUD_PET_LAUNCH_ACCEPTANCE_PASSED");
}

async function writeLaunchEvidence(ok, code, stageResults) {
  await writeCloudPetEvidence(
    process.env.CLOUD_PET_EVIDENCE_FILE,
    createCloudPetEvidenceEnvelope({
      kind: "launchAcceptance",
      ok,
      code,
      releaseId: process.env.CLOUD_PET_RELEASE_ID,
      configFingerprint: process.env.CLOUD_PET_EXPECTED_SAFE_CONFIG_SHA256,
      evidence: { stageResults }
    })
  );
}

main().catch((error) => {
  void writeLaunchEvidence(
    false,
    "CLOUD_PET_LAUNCH_ACCEPTANCE_FAILED",
    []
  ).finally(() => {
  console.error("[cloud-pet-launch] FAILED before stage execution");
  console.error(tail(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
  });
});
