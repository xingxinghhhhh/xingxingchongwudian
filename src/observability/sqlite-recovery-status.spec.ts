import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hashCanonicalRows,
  writeSqliteRestoreDrillAttestation,
  type RecoveryDomains,
  type SqliteRecoveryManifest
} from "../operations/sqlite-recovery";
import { readSqliteRecoveryStatus } from "./sqlite-recovery-status";

const DOMAIN_NAMES: (keyof RecoveryDomains)[] = [
  "customer",
  "memberSession",
  "virtualPet",
  "virtualPetEvent",
  "virtualPetTaskCompletion",
  "virtualPetHomepageVisit",
  "growthTaskTemplate",
  "careScoreConfig",
  "communityPost",
  "communityComment",
  "communityLike",
  "communityFollow",
  "communityReport",
  "operationLog",
  "adminStaffAccount",
  "adminStaffSession"
];

function emptyDomains(): RecoveryDomains {
  return Object.fromEntries(
    DOMAIN_NAMES.map((name) => [name, hashCanonicalRows(name, [])])
  ) as RecoveryDomains;
}

function createManifest(id: string, createdAt: string): SqliteRecoveryManifest {
  const backup = Buffer.from(`sqlite-backup-${id}`);
  return {
    schemaVersion: 1,
    createdAt,
    backupFile: `cloud-pets-${id}.sqlite`,
    backupSizeBytes: backup.length,
    backupSha256: createHash("sha256").update(backup).digest("hex"),
    sqlite: { quickCheck: "ok" },
    migrations: hashCanonicalRows("migrations", []),
    domains: emptyDomains()
  };
}

async function writePair(
  directory: string,
  id: string,
  createdAt: string
): Promise<string> {
  const manifest = createManifest(id, createdAt);
  await writeFile(join(directory, manifest.backupFile), `sqlite-backup-${id}`);
  const manifestPath = join(directory, `cloud-pets-${id}.manifest.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

describe("SQLite recovery status projection", () => {
  let directory: string;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-09T01:00:00.000Z"));
    directory = await mkdtemp(join(tmpdir(), "sqlite-recovery-status-jest-"));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
    jest.useRealTimers();
  });

  it("returns unavailable when no fixed status directory is configured", async () => {
    await expect(readSqliteRecoveryStatus(undefined)).resolves.toEqual({
      status: "unavailable",
      freshness: "unknown"
    });
  });

  it("distinguishes an empty directory from a configured directory", async () => {
    await expect(readSqliteRecoveryStatus(directory)).resolves.toEqual({
      status: "no_backup",
      freshness: "unknown",
      maxBackupAgeHours: 24
    });
  });

  it("reports a valid backup without a restore attestation as unverified", async () => {
    const manifestPath = await writePair(
      directory,
      "one",
      "2026-08-09T00:00:00.000Z"
    );

    await expect(
      readSqliteRecoveryStatus(directory, new Date("2026-08-09T01:00:00.000Z"))
    ).resolves.toMatchObject({
      status: "backup_unverified",
      latestBackup: { createdAt: "2026-08-09T00:00:00.000Z", ageSeconds: 3600 }
    });
    expect(manifestPath).toContain("cloud-pets-one.manifest.json");
  });

  it("reports a passed attestation for the current manifest as recoverable", async () => {
    const manifestPath = await writePair(
      directory,
      "passed",
      "2026-08-09T00:00:00.000Z"
    );
    await writeSqliteRestoreDrillAttestation({
      manifestPath,
      status: "passed",
      checkedAt: "2026-08-09T00:30:00.000Z"
    });

    await expect(readSqliteRecoveryStatus(directory)).resolves.toMatchObject({
      status: "recoverable",
      freshness: "fresh",
      latestRestoreDrill: {
        checkedAt: "2026-08-09T00:30:00.000Z",
        status: "passed"
      }
    });
  });

  it("exposes a failed attestation without treating it as recoverable", async () => {
    const manifestPath = await writePair(
      directory,
      "failed",
      "2026-08-09T00:00:00.000Z"
    );
    await writeSqliteRestoreDrillAttestation({
      manifestPath,
      status: "failed",
      failureCode: "DOMAIN_MISMATCH",
      checkedAt: "2026-08-09T00:30:00.000Z"
    });

    await expect(readSqliteRecoveryStatus(directory)).resolves.toMatchObject({
      status: "drill_failed",
      freshness: "fresh",
      latestRestoreDrill: { status: "failed", failureCode: "DOMAIN_MISMATCH" }
    });
  });

  it("does not let an older attestation validate a newer backup", async () => {
    const oldManifest = await writePair(
      directory,
      "old",
      "2026-08-08T00:00:00.000Z"
    );
    await writeSqliteRestoreDrillAttestation({
      manifestPath: oldManifest,
      status: "passed",
      checkedAt: "2026-08-08T00:30:00.000Z"
    });
    await writePair(directory, "new", "2026-08-09T00:00:00.000Z");

    await expect(readSqliteRecoveryStatus(directory)).resolves.toMatchObject({
      status: "backup_unverified",
      freshness: "fresh",
      latestBackup: { createdAt: "2026-08-09T00:00:00.000Z" }
    });
  });

  it("ignores malformed attestations and path-traversing manifests", async () => {
    const manifestPath = await writePair(
      directory,
      "malformed",
      "2026-08-09T00:00:00.000Z"
    );
    await writeFile(
      join(directory, "cloud-pets-malformed.restore-check.json"),
      "{ not-json"
    );
    const traversal = createManifest("traversal", "2026-08-09T00:01:00.000Z");
    traversal.backupFile = "../outside.sqlite";
    await writeFile(
      join(directory, "cloud-pets-traversal.manifest.json"),
      JSON.stringify(traversal)
    );

    await expect(readSqliteRecoveryStatus(directory)).resolves.toMatchObject({
      status: "backup_unverified",
      freshness: "fresh",
      latestBackup: { createdAt: "2026-08-09T00:00:00.000Z" }
    });
    expect(manifestPath).toContain("cloud-pets-malformed.manifest.json");
  });

  it("returns unavailable when the configured directory cannot be read", async () => {
    const missingDirectory = join(directory, "missing");
    await expect(readSqliteRecoveryStatus(missingDirectory)).resolves.toEqual({
      status: "unavailable",
      freshness: "unknown"
    });
    await mkdir(missingDirectory);
  });

  it("keeps the freshness boundary inclusive and marks older backups stale", async () => {
    await writePair(directory, "boundary", "2026-08-08T00:00:00.000Z");

    await expect(
      readSqliteRecoveryStatus(
        directory,
        new Date("2026-08-09T00:00:00.000Z"),
        24
      )
    ).resolves.toMatchObject({ status: "backup_unverified", freshness: "fresh" });
    await expect(
      readSqliteRecoveryStatus(
        directory,
        new Date("2026-08-09T00:00:01.000Z"),
        24
      )
    ).resolves.toMatchObject({ status: "backup_unverified", freshness: "stale" });
  });

  it("keeps a failed drill as the primary status even when the backup is fresh", async () => {
    const manifestPath = await writePair(
      directory,
      "failed-fresh",
      "2026-08-09T00:00:00.000Z"
    );
    await writeSqliteRestoreDrillAttestation({
      manifestPath,
      status: "failed",
      failureCode: "DOMAIN_MISMATCH",
      checkedAt: "2026-08-09T00:10:00.000Z"
    });

    await expect(
      readSqliteRecoveryStatus(
        directory,
        new Date("2026-08-09T00:30:00.000Z"),
        24
      )
    ).resolves.toMatchObject({ status: "drill_failed", freshness: "fresh" });
  });
});
