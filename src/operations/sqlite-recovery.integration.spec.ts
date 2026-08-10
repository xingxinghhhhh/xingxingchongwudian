import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import {
  createSqliteBackup,
  runSqliteRestoreDrill,
  runSqliteRestoreDrillWithAttestation,
  type SqliteRecoveryManifest
} from "./sqlite-recovery";

const rootDirectory = resolve(__dirname, "../..");
const schemaPath = resolve(rootDirectory, "prisma/schema.prisma");
const prismaCli = resolve(rootDirectory, "node_modules/prisma/build/index.js");

function runMigrations(databaseUrl: string): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", schemaPath],
      {
        cwd: rootDirectory,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        windowsHide: true,
        stdio: "ignore"
      }
    );
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`Prisma migrate deploy failed (${code})`));
      }
    });
  });
}

describe("SQLite recovery integration", () => {
  let temporaryDirectory: string;
  let sourcePath: string;
  let backupPath: string;
  let manifestPath: string;

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "sqlite-recovery-jest-"));
    sourcePath = join(temporaryDirectory, "source.db");
    const outputDirectory = join(temporaryDirectory, "backup");
    await writeFile(sourcePath, Buffer.alloc(0), { flag: "wx" });
    await mkdir(outputDirectory);
    const databaseUrl = `file:${sourcePath.replaceAll("\\", "/")}`;
    await runMigrations(databaseUrl);
    const backup = await createSqliteBackup({
      outputDirectory,
      databaseUrl,
      schemaPath
    });
    backupPath = backup.backupPath;
    manifestPath = backup.manifestPath;
  }, 60_000);

  afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  async function cloneBackupPair(
    name: string
  ): Promise<{ backup: string; manifest: string; value: SqliteRecoveryManifest }> {
    const directory = join(temporaryDirectory, name);
    await mkdir(directory);
    const backup = join(directory, basename(backupPath));
    const manifest = join(directory, basename(manifestPath));
    await copyFile(backupPath, backup);
    await copyFile(manifestPath, manifest);
    const value = JSON.parse(
      await readFile(manifest, "utf8")
    ) as SqliteRecoveryManifest;
    return { backup, manifest, value };
  }

  async function saveManifest(
    path: string,
    value: SqliteRecoveryManifest
  ): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  }

  it("restores an empty migrated database without modifying the source", async () => {
    const sourceHashBefore = createHash("sha256")
      .update(await readFile(sourcePath))
      .digest("hex");

    await expect(runSqliteRestoreDrill({ manifestPath })).resolves.toMatchObject({
      manifest: { schemaVersion: 1 }
    });

    const sourceHashAfter = createHash("sha256")
      .update(await readFile(sourcePath))
      .digest("hex");
    expect(sourceHashAfter).toBe(sourceHashBefore);
  });

  it("rejects a backup whose SHA does not match", async () => {
    const pair = await cloneBackupPair("sha-mismatch");
    pair.value.backupSha256 = "0".repeat(64);
    await saveManifest(pair.manifest, pair.value);

    await expect(
      runSqliteRestoreDrill({ manifestPath: pair.manifest })
    ).rejects.toMatchObject({ code: "BACKUP_SHA_MISMATCH", exitCode: 32 });
  });

  it("rejects a corrupt SQLite file after a valid SHA check", async () => {
    const pair = await cloneBackupPair("quick-check-failure");
    const corruptBytes = Buffer.from("not-a-sqlite-database");
    await writeFile(pair.backup, corruptBytes);
    pair.value.backupSizeBytes = corruptBytes.length;
    pair.value.backupSha256 = createHash("sha256")
      .update(corruptBytes)
      .digest("hex");
    await saveManifest(pair.manifest, pair.value);

    await expect(
      runSqliteRestoreDrill({ manifestPath: pair.manifest })
    ).rejects.toMatchObject({
      code: "RESTORE_QUICK_CHECK_FAILED",
      exitCode: 33
    });
  });

  it("rejects a migration fingerprint mismatch", async () => {
    const pair = await cloneBackupPair("migration-mismatch");
    pair.value.migrations.hash = "1".repeat(64);
    await saveManifest(pair.manifest, pair.value);

    await expect(
      runSqliteRestoreDrill({ manifestPath: pair.manifest })
    ).rejects.toMatchObject({ code: "MIGRATION_MISMATCH", exitCode: 34 });
  });

  it("rejects a domain fingerprint mismatch", async () => {
    const pair = await cloneBackupPair("domain-mismatch");
    pair.value.domains.virtualPetEvent.hash = "2".repeat(64);
    await saveManifest(pair.manifest, pair.value);

    await expect(
      runSqliteRestoreDrill({ manifestPath: pair.manifest })
    ).rejects.toMatchObject({ code: "DOMAIN_MISMATCH", exitCode: 35 });
  });

  it("publishes a failed attestation for a valid manifest that fails the drill", async () => {
    const pair = await cloneBackupPair("failed-attestation");
    pair.value.domains.virtualPetEvent.hash = "3".repeat(64);
    await saveManifest(pair.manifest, pair.value);

    await expect(
      runSqliteRestoreDrillWithAttestation({ manifestPath: pair.manifest })
    ).rejects.toMatchObject({ code: "DOMAIN_MISMATCH", exitCode: 35 });

    const attestation = JSON.parse(
      await readFile(
        join(
          temporaryDirectory,
          "failed-attestation",
          `${basename(pair.manifest, ".manifest.json")}.restore-check.json`
        ),
        "utf8"
      )
    ) as { manifestFile?: string; status?: string; failureCode?: string };
    expect(attestation).toMatchObject({
      manifestFile: basename(pair.manifest),
      status: "failed",
      failureCode: "DOMAIN_MISMATCH"
    });
  });
});
