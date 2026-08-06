import {
  asSqliteRecoveryError,
  runSqliteRestoreDrill
} from "../src/operations/sqlite-recovery";

function readManifestPath(argv: string[]): string {
  if (argv.length !== 2 || argv[0] !== "--manifest" || !argv[1]) {
    throw new Error("Expected --manifest <manifest-file>");
  }
  return argv[1];
}

async function main(): Promise<void> {
  try {
    const manifestPath = readManifestPath(process.argv.slice(2));
    const result = await runSqliteRestoreDrill({
      manifestPath,
      keepTemporaryDirectory: process.env.KEEP_SQLITE_RESTORE_DRILL === "1"
    });
    console.log(
      JSON.stringify({
        ok: true,
        code: "SQLITE_RESTORE_DRILL_PASSED",
        backupFile: result.manifest.backupFile
      })
    );
  } catch (error) {
    const recoveryError = asSqliteRecoveryError(error);
    const isArgumentError =
      error instanceof Error &&
      error.message === "Expected --manifest <manifest-file>";
    const code = isArgumentError ? "INVALID_ARGUMENT" : recoveryError.code;
    const exitCode = isArgumentError ? 10 : recoveryError.exitCode;
    console.error(
      JSON.stringify({
        ok: false,
        code,
        exitCode,
        message: isArgumentError
          ? "必须提供 --manifest"
          : recoveryError.message,
        ...(recoveryError.details ? { details: recoveryError.details } : {})
      })
    );
    process.exitCode = exitCode;
  }
}

void main();
