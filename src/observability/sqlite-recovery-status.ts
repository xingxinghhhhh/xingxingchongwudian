import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import {
  DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS,
  resolveSqliteRecoveryMaxBackupAgeHours
} from "../config/sqlite-recovery";
import {
  assertSqliteRecoveryManifest,
  SQLITE_RESTORE_DRILL_ATTESTATION_SCHEMA_VERSION,
  type SqliteRecoveryManifest,
  type SqliteRestoreDrillAttestation
} from "../operations/sqlite-recovery";

export type SqliteRecoveryStatus =
  | "no_backup"
  | "backup_unverified"
  | "recoverable"
  | "drill_failed"
  | "unavailable";

export type SqliteRecoveryStatusSnapshot = {
  status: SqliteRecoveryStatus;
  freshness: "fresh" | "stale" | "unknown";
  maxBackupAgeHours?: number;
  latestBackup?: { createdAt: string; ageSeconds: number };
  latestRestoreDrill?: {
    checkedAt: string;
    status: "passed" | "failed";
    failureCode?: string;
  };
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

function isManifestFile(name: string): boolean {
  return name.endsWith(".manifest.json") && name === basename(name);
}

function isValidAttestation(
  value: unknown
): value is SqliteRestoreDrillAttestation {
  if (!value || typeof value !== "object") return false;
  const artifact = value as Partial<SqliteRestoreDrillAttestation>;
  return (
    artifact.schemaVersion === SQLITE_RESTORE_DRILL_ATTESTATION_SCHEMA_VERSION &&
    typeof artifact.manifestFile === "string" &&
    artifact.manifestFile === basename(artifact.manifestFile) &&
    !artifact.manifestFile.includes("..") &&
    !artifact.manifestFile.includes("/") &&
    !artifact.manifestFile.includes("\\") &&
    HASH_PATTERN.test(artifact.manifestSha256 ?? "") &&
    typeof artifact.checkedAt === "string" &&
    !Number.isNaN(Date.parse(artifact.checkedAt)) &&
    (artifact.status === "passed" || artifact.status === "failed") &&
    (artifact.failureCode === undefined || typeof artifact.failureCode === "string")
  );
}

async function readManifest(path: string): Promise<SqliteRecoveryManifest | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    assertSqliteRecoveryManifest(value);
    return value;
  } catch {
    return null;
  }
}

async function readAttestation(
  path: string,
  manifestPath: string
): Promise<SqliteRecoveryStatusSnapshot["latestRestoreDrill"]> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!isValidAttestation(value) || value.manifestFile !== basename(manifestPath)) {
      return undefined;
    }
    if ((await sha256File(manifestPath)) !== value.manifestSha256) {
      return undefined;
    }
    return {
      checkedAt: value.checkedAt,
      status: value.status,
      ...(value.status === "failed" && value.failureCode
        ? { failureCode: value.failureCode }
        : {})
    };
  } catch {
    return undefined;
  }
}

export async function readSqliteRecoveryStatus(
  statusDirectory: string | undefined,
  now = new Date(),
  maxBackupAgeHours = DEFAULT_SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS
): Promise<SqliteRecoveryStatusSnapshot> {
  if (!statusDirectory?.trim()) {
    return { status: "unavailable", freshness: "unknown" };
  }

  let entries: Array<{ name: string; isFile(): boolean }>;
  try {
    entries = await readdir(resolve(statusDirectory), { withFileTypes: true });
  } catch {
    return { status: "unavailable", freshness: "unknown" };
  }

  const manifests = (
    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && isManifestFile(entry.name))
        .map(async (entry) => {
          const path = join(resolve(statusDirectory), entry.name);
          const manifest = await readManifest(path);
          return manifest ? { path, manifest } : null;
        })
    )
  ).filter(
    (entry): entry is { path: string; manifest: SqliteRecoveryManifest } =>
      entry !== null
  );

  if (manifests.length === 0) {
    return {
      status: "no_backup",
      freshness: "unknown",
      maxBackupAgeHours
    };
  }

  manifests.sort((left, right) => {
    const byDate = Date.parse(right.manifest.createdAt) - Date.parse(left.manifest.createdAt);
    return byDate || right.manifest.backupFile.localeCompare(left.manifest.backupFile);
  });
  const latest = manifests[0];
  const latestBackup = {
    createdAt: latest.manifest.createdAt,
    ageSeconds: Math.max(0, Math.floor((now.getTime() - Date.parse(latest.manifest.createdAt)) / 1000))
  };
  const freshness =
    latestBackup.ageSeconds <= maxBackupAgeHours * 60 * 60 ? "fresh" : "stale";
  const attestationPath = join(
    resolve(statusDirectory),
    `${basename(latest.path, ".manifest.json")}.restore-check.json`
  );
  const latestRestoreDrill = await readAttestation(attestationPath, latest.path);
  let backupExists = false;
  try {
    await stat(join(resolve(statusDirectory), latest.manifest.backupFile));
    backupExists = true;
  } catch {
    backupExists = false;
  }

  const status =
    !backupExists || !latestRestoreDrill
      ? "backup_unverified"
      : latestRestoreDrill.status === "failed"
        ? "drill_failed"
        : "recoverable";

  return {
    status,
    freshness,
    maxBackupAgeHours,
    latestBackup,
    ...(latestRestoreDrill ? { latestRestoreDrill } : {})
  };
}

@Injectable()
export class SqliteRecoveryStatusService {
  constructor(private readonly configService: ConfigService) {}

  getStatus(): Promise<SqliteRecoveryStatusSnapshot> {
    const maxBackupAgeHours = resolveSqliteRecoveryMaxBackupAgeHours({
      SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: this.configService.get<string>(
        "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS"
      )
    });
    return readSqliteRecoveryStatus(
      this.configService.get<string>("SQLITE_RECOVERY_STATUS_DIR"),
      new Date(),
      maxBackupAgeHours
    );
  }
}
