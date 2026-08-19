import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CLOUD_PET_PRODUCTION_NO_GO,
  evaluateCloudPetProductionEvidence
} from "../src/observability/cloud-pet-production-go-no-go";

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function readStdin() {
  return new Promise<string>((resolveInput) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      input += chunk;
    });
    process.stdin.on("end", () => resolveInput(input));
  });
}

async function main() {
  const evidenceFile = readArgument("--evidence-file") ?? process.env.CLOUD_PET_PRODUCTION_EVIDENCE_FILE;
  const useStdin = process.argv.includes("--stdin");
  if (!evidenceFile && !useStdin) {
    console.error(JSON.stringify({
      ok: false,
      code: CLOUD_PET_PRODUCTION_NO_GO,
      evidence: {
        schemaVersion: 1,
        failures: [{ check: "input", reason: "EVIDENCE_FILE_REQUIRED" }]
      }
    }));
    process.exitCode = 1;
    return;
  }

  try {
    const source = useStdin
      ? await readStdin()
      : await readFile(resolve(evidenceFile as string), "utf8");
    const parsed = JSON.parse(source) as unknown;
    const result = evaluateCloudPetProductionEvidence(parsed);
    const output = JSON.stringify(result);
    if (result.ok) console.log(output);
    else {
      console.error(output);
      process.exitCode = 1;
    }
  } catch {
    console.error(JSON.stringify({
      ok: false,
      code: CLOUD_PET_PRODUCTION_NO_GO,
      evidence: {
        schemaVersion: 1,
        failures: [{ check: "input", reason: "EVIDENCE_FILE_UNREADABLE" }]
      }
    }));
    process.exitCode = 1;
  }
}

void main();
