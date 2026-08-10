import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { resolveSqliteRecoveryAutoRefreshEnabled } from "../config/sqlite-recovery-auto-refresh";
import {
  SqliteRecoveryOperationsService,
  SqliteRecoveryRunInProgressError
} from "./sqlite-recovery-operations";
import { SqliteRecoveryStatusService } from "./sqlite-recovery-status";
import { asSqliteRecoveryError } from "../operations/sqlite-recovery";

export const SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS = 1_000;
export const SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1_000;

export type SqliteRecoveryAutoRefreshOutcome =
  | "not_run_yet"
  | "run_succeeded"
  | "skipped_fresh"
  | "skipped_ineligible"
  | "skipped_busy"
  | "skipped_suppressed"
  | "run_failed";

export type SqliteRecoveryAutoRefreshRuntimeStatus = {
  lastCheckedAt: string | null;
  lastOutcome: SqliteRecoveryAutoRefreshOutcome;
  reasonCode: string | null;
  suppressionActive: boolean;
  nextCheckAt: string | null;
};

const SAFE_AUTO_REFRESH_REASON_CODES = new Set([
  "STATUS_READ_FAILED",
  "SQLITE_RECOVERY_AUTO_REFRESH_SUPPRESSED",
  "SQLITE_RECOVERY_ALREADY_RUNNING",
  "SQLITE_RECOVERY_STATUS_DIR_REQUIRED",
  "INVALID_ARGUMENT",
  "INVALID_DATABASE_URL",
  "SOURCE_DATABASE_NOT_FOUND",
  "UNSAFE_OUTPUT_PATH",
  "MIGRATION_STATE_INVALID",
  "VACUUM_INTO_FAILED",
  "BACKUP_QUICK_CHECK_FAILED",
  "BACKUP_MANIFEST_WRITE_FAILED",
  "MANIFEST_INVALID",
  "BACKUP_NOT_FOUND",
  "BACKUP_SHA_MISMATCH",
  "RESTORE_QUICK_CHECK_FAILED",
  "MIGRATION_MISMATCH",
  "DOMAIN_MISMATCH",
  "UNEXPECTED_ERROR",
  "no_backup",
  "backup_unverified",
  "recoverable",
  "drill_failed",
  "unavailable"
]);

function toSafeAutoRefreshReasonCode(code: string) {
  return SAFE_AUTO_REFRESH_REASON_CODES.has(code) ? code : "UNEXPECTED_ERROR";
}

@Injectable()
export class SqliteRecoveryAutoRefreshService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SqliteRecoveryAutoRefreshService.name);
  private readonly enabled: boolean;
  private initialTimer: NodeJS.Timeout | undefined;
  private intervalTimer: NodeJS.Timeout | undefined;
  private automaticRecoverySuppressedAfterFailure = false;
  private destroyed = false;
  private runtimeStatus: SqliteRecoveryAutoRefreshRuntimeStatus = {
    lastCheckedAt: null,
    lastOutcome: "not_run_yet",
    reasonCode: null,
    suppressionActive: false,
    nextCheckAt: null
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly statusService: SqliteRecoveryStatusService,
    private readonly operationsService: SqliteRecoveryOperationsService
  ) {
    this.enabled = resolveSqliteRecoveryAutoRefreshEnabled({
      SQLITE_RECOVERY_AUTO_REFRESH_ENABLED: this.configService.get<string>(
        "SQLITE_RECOVERY_AUTO_REFRESH_ENABLED"
      )
    });
  }

  isEnabled() {
    return this.enabled;
  }

  getRuntimeStatus(): SqliteRecoveryAutoRefreshRuntimeStatus {
    return { ...this.runtimeStatus };
  }

  onModuleInit() {
    if (!this.enabled) return;

    this.destroyed = false;
    this.runtimeStatus.nextCheckAt = new Date(
      Date.now() + SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS
    ).toISOString();
    this.initialTimer = setTimeout(() => {
      this.initialTimer = undefined;
      if (this.destroyed) return;
      void this.runCheck();
      if (this.destroyed) return;
      this.runtimeStatus.nextCheckAt = new Date(
        Date.now() + SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS
      ).toISOString();
      this.intervalTimer = setInterval(
        () => {
          if (this.destroyed) return;
          this.runtimeStatus.nextCheckAt = new Date(
            Date.now() + SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS
          ).toISOString();
          void this.runCheck();
        },
        SQLITE_RECOVERY_AUTO_REFRESH_INTERVAL_MS
      );
    }, SQLITE_RECOVERY_AUTO_REFRESH_INITIAL_DELAY_MS);
  }

  onModuleDestroy() {
    this.destroyed = true;
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = undefined;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = undefined;
    }
    this.runtimeStatus.nextCheckAt = null;
  }

  async runCheck() {
    if (!this.enabled) {
      return;
    }

    this.runtimeStatus.lastCheckedAt = new Date().toISOString();
    this.runtimeStatus.suppressionActive =
      this.automaticRecoverySuppressedAfterFailure;

    if (this.automaticRecoverySuppressedAfterFailure) {
      this.setRuntimeStatus(
        "skipped_suppressed",
        this.runtimeStatus.reasonCode ?? "SQLITE_RECOVERY_AUTO_REFRESH_SUPPRESSED"
      );
      return;
    }

    let snapshot;
    try {
      snapshot = await this.statusService.getStatus();
    } catch {
      this.setRuntimeStatus("run_failed", "STATUS_READ_FAILED");
      this.writeLog("check_failed", { reason: "STATUS_READ_FAILED" }, true);
      return;
    }

    const shouldRefresh =
      snapshot.status === "no_backup" ||
      (snapshot.status === "recoverable" && snapshot.freshness === "stale");

    if (!shouldRefresh) {
      this.setRuntimeStatus(
        snapshot.status === "recoverable" && snapshot.freshness === "fresh"
          ? "skipped_fresh"
          : "skipped_ineligible",
        snapshot.status
      );
      this.writeLog("check_skipped", {
        status: snapshot.status,
        freshness: snapshot.freshness
      });
      return;
    }

    this.writeLog("run_start", {
      status: snapshot.status,
      freshness: snapshot.freshness
    });

    try {
      const result = await this.operationsService.createAndVerify();
      this.runtimeStatus.suppressionActive = false;
      this.setRuntimeStatus("run_succeeded", null);
      this.writeLog("run_success", {
        status: result.status,
        freshness: result.freshness
      });
    } catch (error) {
      if (
        error instanceof SqliteRecoveryRunInProgressError ||
        (error as { code?: string } | null)?.code ===
          "SQLITE_RECOVERY_ALREADY_RUNNING"
      ) {
        this.setRuntimeStatus("skipped_busy", "SQLITE_RECOVERY_ALREADY_RUNNING");
        this.writeLog("check_skipped", {
          reason: "SQLITE_RECOVERY_ALREADY_RUNNING"
        });
        return;
      }

      this.automaticRecoverySuppressedAfterFailure = true;
      this.runtimeStatus.suppressionActive = true;
      const code =
        (error as { code?: string } | null)?.code ?? asSqliteRecoveryError(error).code;
      this.setRuntimeStatus("run_failed", code);
      this.writeLog("run_failed", { reason: code }, true);
    }
  }

  private setRuntimeStatus(
    lastOutcome: SqliteRecoveryAutoRefreshOutcome,
    reasonCode: string | null
  ) {
    this.runtimeStatus = {
      ...this.runtimeStatus,
      lastOutcome,
      reasonCode: reasonCode ? toSafeAutoRefreshReasonCode(reasonCode) : null,
      suppressionActive: this.automaticRecoverySuppressedAfterFailure
    };
  }

  private writeLog(
    phase: "check_failed" | "check_skipped" | "run_start" | "run_success" | "run_failed",
    details: Record<string, string>,
    error = false
  ) {
    const message = JSON.stringify({
      event: "sqlite_recovery_auto_refresh",
      phase,
      ...details
    });
    if (error) {
      this.logger.error(message);
    } else {
      this.logger.log(message);
    }
  }
}
