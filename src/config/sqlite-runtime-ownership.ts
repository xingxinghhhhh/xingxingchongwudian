import { randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SQLITE_RUNTIME_OWNERSHIP_CONFLICT =
  "SQLITE_RUNTIME_OWNERSHIP_CONFLICT" as const;
export const SQLITE_RUNTIME_OWNERSHIP_FAILED =
  "SQLITE_RUNTIME_OWNERSHIP_FAILED" as const;

type RuntimeOwnershipRecord = {
  version: 1;
  pid: number;
  token: string;
  startedAt: string;
  databasePath: string;
};

export class SqliteRuntimeOwnershipError extends Error {
  constructor(
    readonly code:
      | typeof SQLITE_RUNTIME_OWNERSHIP_CONFLICT
      | typeof SQLITE_RUNTIME_OWNERSHIP_FAILED,
    message: string
  ) {
    super(message);
    this.name = "SqliteRuntimeOwnershipError";
  }
}

function getDatabasePathFromUrl(databaseUrl: string) {
  const rawPath = databaseUrl.slice("file:".length).split(/[?#]/, 1)[0];
  if (!rawPath || rawPath.startsWith(":memory:")) return null;

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return null;
  }

  if (/^\/[A-Za-z]:[\\/]/.test(decodedPath)) {
    return normalize(decodedPath.slice(1));
  }

  if (decodedPath.startsWith("//")) {
    try {
      return normalize(fileURLToPath(`file:${decodedPath}`));
    } catch {
      return null;
    }
  }

  return normalize(
    isAbsolute(decodedPath) ? decodedPath : resolve(process.cwd(), decodedPath)
  );
}

export function resolveSqliteDatabasePath(databaseUrl?: string) {
  const normalizedUrl = databaseUrl?.trim() ?? "";
  if (!normalizedUrl.toLowerCase().startsWith("file:")) return null;
  return getDatabasePathFromUrl(normalizedUrl);
}

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function readOwnershipRecord(lockPath: string): RuntimeOwnershipRecord | null {
  try {
    const parsed = JSON.parse(readFileSync(lockPath, "utf8")) as Partial<RuntimeOwnershipRecord>;
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.pid) ||
      !parsed.token ||
      !parsed.startedAt ||
      !parsed.databasePath
    ) {
      return null;
    }
    return parsed as RuntimeOwnershipRecord;
  } catch {
    return null;
  }
}

function writeOwnershipRecord(lockPath: string, record: RuntimeOwnershipRecord) {
  writeFileSync(lockPath, `${JSON.stringify(record)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600
  });
}

export class SqliteRuntimeOwnership {
  private released = false;
  private handlersInstalled = false;

  private readonly releaseOnSignal = () => this.release();
  private readonly releaseOnExit = () => this.release();

  constructor(
    private readonly lockPath: string | null,
    private readonly token: string | null
  ) {}

  installProcessShutdownHooks() {
    if (!this.lockPath || this.handlersInstalled) return;
    this.handlersInstalled = true;
    process.once("SIGINT", this.releaseOnSignal);
    process.once("SIGTERM", this.releaseOnSignal);
    process.once("exit", this.releaseOnExit);
  }

  release() {
    if (this.released) return;
    this.released = true;

    if (this.handlersInstalled) {
      process.removeListener("SIGINT", this.releaseOnSignal);
      process.removeListener("SIGTERM", this.releaseOnSignal);
      process.removeListener("exit", this.releaseOnExit);
      this.handlersInstalled = false;
    }

    if (!this.lockPath || !this.token || !existsSync(this.lockPath)) return;
    const current = readOwnershipRecord(this.lockPath);
    if (current?.token !== this.token) return;

    try {
      unlinkSync(this.lockPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function acquireProductionSqliteRuntimeOwnership(options: {
  production: boolean;
  databaseUrl?: string;
  useMemoryStore?: string;
}) {
  if (
    !options.production ||
    options.useMemoryStore?.trim().toLowerCase() === "true"
  ) {
    return new SqliteRuntimeOwnership(null, null);
  }

  const databasePath = resolveSqliteDatabasePath(options.databaseUrl);
  if (!databasePath) return new SqliteRuntimeOwnership(null, null);

  const lockPath = `${databasePath}.runtime.lock`;
  const token = randomUUID();
  const record: RuntimeOwnershipRecord = {
    version: 1,
    pid: process.pid,
    token,
    startedAt: new Date().toISOString(),
    databasePath
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      writeOwnershipRecord(lockPath, record);
      return new SqliteRuntimeOwnership(lockPath, token);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        throw new SqliteRuntimeOwnershipError(
          SQLITE_RUNTIME_OWNERSHIP_FAILED,
          "Unable to acquire SQLite runtime ownership"
        );
      }

      const existing = readOwnershipRecord(lockPath);
      if (existing && isProcessAlive(existing.pid)) {
        throw new SqliteRuntimeOwnershipError(
          SQLITE_RUNTIME_OWNERSHIP_CONFLICT,
          "Another runtime already owns this SQLite database"
        );
      }

      try {
        unlinkSync(lockPath);
      } catch (unlinkError) {
        if ((unlinkError as NodeJS.ErrnoException).code !== "ENOENT") {
          throw new SqliteRuntimeOwnershipError(
            SQLITE_RUNTIME_OWNERSHIP_FAILED,
            "Unable to clear stale SQLite runtime ownership"
          );
        }
      }
    }
  }

  throw new SqliteRuntimeOwnershipError(
    SQLITE_RUNTIME_OWNERSHIP_CONFLICT,
    "SQLite runtime ownership changed during acquisition"
  );
}
