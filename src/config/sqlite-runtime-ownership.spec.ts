import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import {
  acquireProductionSqliteRuntimeOwnership,
  resolveSqliteDatabasePath,
  SQLITE_RUNTIME_OWNERSHIP_CONFLICT
} from "./sqlite-runtime-ownership";

describe("SQLite runtime ownership", () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "kzt-sqlite-runtime-ownership-"));
  });

  afterEach(() => {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it("serializes runtimes for the same normalized database path and releases cleanly", () => {
    const databasePath = join(temporaryDirectory, "data.db");
    const relativePath = relative(process.cwd(), databasePath).replaceAll("\\", "/");
    const first = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${relativePath}`
    });

    try {
      acquireProductionSqliteRuntimeOwnership({
        production: true,
        databaseUrl: `file:${databasePath.replaceAll("\\", "/")}`
      });
      throw new Error("Expected SQLite runtime ownership conflict");
    } catch (error) {
      expect(error).toMatchObject({ code: SQLITE_RUNTIME_OWNERSHIP_CONFLICT });
    }

    first.release();
    const replacement = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${databasePath.replaceAll("\\", "/")}`
    });
    replacement.release();
  });

  it("allows separate databases to start at the same time", () => {
    const first = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${join(temporaryDirectory, "one.db").replaceAll("\\", "/")}`
    });
    const second = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${join(temporaryDirectory, "two.db").replaceAll("\\", "/")}`
    });

    expect(resolveSqliteDatabasePath(`file:${join(temporaryDirectory, "one.db")}`)).toBe(
      join(temporaryDirectory, "one.db")
    );
    first.release();
    second.release();
  });

  it("removes a stale owner record when its process is no longer alive", () => {
    const databasePath = join(temporaryDirectory, "stale.db");
    writeFileSync(
      `${databasePath}.runtime.lock`,
      JSON.stringify({
        version: 1,
        pid: 2_147_483_647,
        token: "stale-token",
        startedAt: new Date(0).toISOString(),
        databasePath
      })
    );

    const ownership = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${databasePath.replaceAll("\\", "/")}`
    });
    ownership.release();
  });

  it("does not create a lock outside production or for memory storage", () => {
    const databasePath = join(temporaryDirectory, "data.db");
    const development = acquireProductionSqliteRuntimeOwnership({
      production: false,
      databaseUrl: `file:${databasePath}`
    });
    const memory = acquireProductionSqliteRuntimeOwnership({
      production: true,
      databaseUrl: `file:${databasePath}`,
      useMemoryStore: "true"
    });

    expect(development).toBeDefined();
    expect(memory).toBeDefined();
    development.release();
    memory.release();
  });
});
