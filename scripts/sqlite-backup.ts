import { resolve } from "node:path";
import {
  asSqliteRecoveryError,
  createSqliteBackup
} from "../src/operations/sqlite-recovery";

function readOutputDirectory(argv: string[]): string {
  if (argv.length !== 2 || argv[0] !== "--output-dir" || !argv[1]) {
    throw new Error("Expected --output-dir <directory>");
  }
  return argv[1];
}

async function main(): Promise<void> {
  try {
    const outputDirectory = readOutputDirectory(process.argv.slice(2));
    const result = await createSqliteBackup({
      outputDirectory,
      schemaPath: resolve(process.cwd(), "prisma/schema.prisma")
    });
    console.log(
      JSON.stringify({
        ok: true,
        code: "SQLITE_BACKUP_CREATED",
        backupFile: result.manifest.backupFile,
        manifestFile: result.manifestPath.split(/[\\/]/).at(-1)
      })
    );
  } catch (error) {
    const recoveryError = asSqliteRecoveryError(error);
    const isArgumentError =
      error instanceof Error &&
      error.message === "Expected --output-dir <directory>";
    const code = isArgumentError ? "INVALID_ARGUMENT" : recoveryError.code;
    const exitCode = isArgumentError ? 10 : recoveryError.exitCode;
    console.error(
      JSON.stringify({
        ok: false,
        code,
        exitCode,
        message: isArgumentError
          ? "必须提供 --output-dir"
          : recoveryError.message,
        ...(recoveryError.details ? { details: recoveryError.details } : {})
      })
    );
    process.exitCode = exitCode;
  }
}

void main();
