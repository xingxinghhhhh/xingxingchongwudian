import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolve } from "node:path";
import {
  createSqliteBackup,
  runSqliteRestoreDrillWithAttestation
} from "../operations/sqlite-recovery";
import { resolveSqliteRecoveryMaxBackupAgeHours } from "../config/sqlite-recovery";
import {
  readSqliteRecoveryStatus,
  type SqliteRecoveryStatusSnapshot
} from "./sqlite-recovery-status";

export class SqliteRecoveryRunInProgressError extends Error {
  readonly code = "SQLITE_RECOVERY_ALREADY_RUNNING";
}

export class SqliteRecoveryNotConfiguredError extends Error {
  readonly code = "SQLITE_RECOVERY_STATUS_DIR_REQUIRED";
}

@Injectable()
export class SqliteRecoveryOperationsService {
  private runInProgress = false;

  constructor(private readonly configService: ConfigService) {}

  async createAndVerify(): Promise<SqliteRecoveryStatusSnapshot> {
    if (this.runInProgress) {
      throw new SqliteRecoveryRunInProgressError(
        "A SQLite recovery run is already in progress"
      );
    }

    const outputDirectory = this.configService
      .get<string>("SQLITE_RECOVERY_STATUS_DIR")
      ?.trim();
    if (!outputDirectory) {
      throw new SqliteRecoveryNotConfiguredError(
        "SQLITE_RECOVERY_STATUS_DIR is required for an Admin recovery run"
      );
    }

    this.runInProgress = true;
    try {
      const backup = await createSqliteBackup({
        outputDirectory,
        databaseUrl: this.configService.get<string>("DATABASE_URL"),
        schemaPath: resolve(process.cwd(), "prisma/schema.prisma")
      });
      await runSqliteRestoreDrillWithAttestation({
        manifestPath: backup.manifestPath
      });

      return readSqliteRecoveryStatus(
        outputDirectory,
        new Date(),
        resolveSqliteRecoveryMaxBackupAgeHours({
          SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS: this.configService.get<string>(
            "SQLITE_RECOVERY_MAX_BACKUP_AGE_HOURS"
          )
        })
      );
    } finally {
      this.runInProgress = false;
    }
  }
}
