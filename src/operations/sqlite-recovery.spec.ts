import { resolve, win32 } from "node:path";
import {
  assertSqliteRecoveryManifest,
  escapeSqliteStringLiteral,
  hashCanonicalRows,
  resolveSqliteDatabasePath,
  SqliteRecoveryError,
  type RecoveryDomains,
  type SqliteRecoveryManifest
} from "./sqlite-recovery";

function emptyDomains(): RecoveryDomains {
  const domainNames: (keyof RecoveryDomains)[] = [
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
  return Object.fromEntries(
    domainNames.map((name) => [name, hashCanonicalRows(name, [])])
  ) as RecoveryDomains;
}

function validManifest(): SqliteRecoveryManifest {
  return {
    schemaVersion: 1,
    createdAt: "2026-08-02T12:00:00.000Z",
    backupFile: "cloud-pets-20260802T120000000Z-a1b2c3d4.sqlite",
    backupSizeBytes: 1024,
    backupSha256: "a".repeat(64),
    sqlite: { quickCheck: "ok" },
    migrations: hashCanonicalRows("migrations", []),
    domains: emptyDomains()
  };
}

describe("SQLite recovery primitives", () => {
  it("resolves relative SQLite URLs from the Prisma schema directory", () => {
    const schemaPath = resolve("workspace", "prisma", "schema.prisma");

    expect(resolveSqliteDatabasePath("file:./prod.db", schemaPath)).toBe(
      resolve("workspace", "prisma", "prod.db")
    );
    expect(
      resolveSqliteDatabasePath("file:./backup%20copy.db", schemaPath)
    ).toBe(resolve("workspace", "prisma", "backup copy.db"));
  });

  it("preserves Windows absolute SQLite paths", () => {
    expect(
      resolveSqliteDatabasePath(
        "file:C:/recovery/source.db",
        "D:/workspace/prisma/schema.prisma"
      )
    ).toBe(win32.normalize("C:/recovery/source.db"));
  });

  it.each([
    undefined,
    "",
    "postgresql://db.example.com/app",
    "file::memory:",
    "file:./prod.db?mode=memory",
    "file:./prod.db#fragment",
    "file:./bad\0name.db"
  ])("rejects unsafe database URL %p", (databaseUrl) => {
    expect(() => resolveSqliteDatabasePath(databaseUrl)).toThrow(
      SqliteRecoveryError
    );
  });

  it("escapes SQLite string literals without accepting NUL", () => {
    expect(escapeSqliteStringLiteral("D:\\owner's backup\\pet.db")).toBe(
      "'D:\\owner''s backup\\pet.db'"
    );
    expect(() => escapeSqliteStringLiteral("bad\0path")).toThrow(
      SqliteRecoveryError
    );
  });

  it("produces stable, domain-separated hashes", () => {
    const left = hashCanonicalRows("virtualPet", [
      { updatedAt: new Date("2026-08-02T00:00:00.000Z"), id: "pet-1" }
    ]);
    const right = hashCanonicalRows("virtualPet", [
      { id: "pet-1", updatedAt: new Date("2026-08-02T00:00:00.000Z") }
    ]);

    expect(left).toEqual(right);
    expect(left.count).toBe(1);
    expect(hashCanonicalRows("customer", []).hash).not.toBe(
      hashCanonicalRows("virtualPet", []).hash
    );
  });

  it("accepts the v1 manifest and rejects backup path traversal", () => {
    const manifest = validManifest();
    expect(() => assertSqliteRecoveryManifest(manifest)).not.toThrow();

    expect(() =>
      assertSqliteRecoveryManifest({
        ...manifest,
        backupFile: "../source.sqlite"
      })
    ).toThrow(SqliteRecoveryError);
  });

  it("rejects manifests with missing or unexpected domains", () => {
    const manifest = validManifest();
    const { communityReport: _removed, ...missingDomain } = manifest.domains;

    expect(() =>
      assertSqliteRecoveryManifest({ ...manifest, domains: missingDomain })
    ).toThrow(SqliteRecoveryError);
    expect(() =>
      assertSqliteRecoveryManifest({
        ...manifest,
        domains: { ...manifest.domains, unexpected: manifest.migrations }
      })
    ).toThrow(SqliteRecoveryError);
  });
});
