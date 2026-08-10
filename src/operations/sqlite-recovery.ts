import { createHash, randomBytes } from "node:crypto";
import {
  access,
  chmod,
  copyFile,
  link,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  win32
} from "node:path";
import { PrismaClient } from "@prisma/client";

export const SQLITE_RECOVERY_SCHEMA_VERSION = 1 as const;

export const SQLITE_RECOVERY_EXIT_CODES = {
  INVALID_ARGUMENT: 10,
  INVALID_DATABASE_URL: 11,
  SOURCE_DATABASE_NOT_FOUND: 12,
  UNSAFE_OUTPUT_PATH: 13,
  MIGRATION_STATE_INVALID: 20,
  VACUUM_INTO_FAILED: 21,
  BACKUP_QUICK_CHECK_FAILED: 22,
  BACKUP_MANIFEST_WRITE_FAILED: 23,
  MANIFEST_INVALID: 30,
  BACKUP_NOT_FOUND: 31,
  BACKUP_SHA_MISMATCH: 32,
  RESTORE_QUICK_CHECK_FAILED: 33,
  MIGRATION_MISMATCH: 34,
  DOMAIN_MISMATCH: 35,
  UNEXPECTED_ERROR: 40
} as const;

export type SqliteRecoveryErrorCode =
  keyof typeof SQLITE_RECOVERY_EXIT_CODES;

export type CountHash = {
  count: number;
  hash: string;
};

export type RecoveryDomains = {
  customer: CountHash;
  memberSession: CountHash;
  virtualPet: CountHash;
  virtualPetEvent: CountHash;
  virtualPetTaskCompletion: CountHash;
  virtualPetHomepageVisit: CountHash;
  growthTaskTemplate: CountHash;
  careScoreConfig: CountHash;
  communityPost: CountHash;
  communityComment: CountHash;
  communityLike: CountHash;
  communityFollow: CountHash;
  communityReport: CountHash;
  operationLog: CountHash;
  adminStaffAccount: CountHash;
  adminStaffSession: CountHash;
};

export type SqliteRecoverySnapshot = {
  migrations: CountHash;
  domains: RecoveryDomains;
};

export type SqliteRecoveryManifest = SqliteRecoverySnapshot & {
  schemaVersion: typeof SQLITE_RECOVERY_SCHEMA_VERSION;
  createdAt: string;
  backupFile: string;
  backupSizeBytes: number;
  backupSha256: string;
  sqlite: {
    quickCheck: "ok";
  };
};

export const SQLITE_RESTORE_DRILL_ATTESTATION_SCHEMA_VERSION = 1 as const;

export type SqliteRestoreDrillAttestation = {
  schemaVersion: typeof SQLITE_RESTORE_DRILL_ATTESTATION_SCHEMA_VERSION;
  manifestFile: string;
  manifestSha256: string;
  checkedAt: string;
  status: "passed" | "failed";
  failureCode?: SqliteRecoveryErrorCode;
};

export class SqliteRecoveryError extends Error {
  readonly exitCode: number;
  readonly cause?: unknown;

  constructor(
    readonly code: SqliteRecoveryErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    options?: { cause?: unknown }
  ) {
    super(message);
    this.name = "SqliteRecoveryError";
    this.exitCode = SQLITE_RECOVERY_EXIT_CODES[code];
    this.cause = options?.cause;
  }
}

type DomainDefinition = {
  name: keyof RecoveryDomains;
  table: string;
  idColumn: string;
  columns: string[];
};

const PAGE_SIZE = 500;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

// These fixed selectors deliberately omit personal data, free text and credentials.
const DOMAIN_DEFINITIONS: DomainDefinition[] = [
  {
    name: "customer",
    table: "Customer",
    idColumn: "id",
    columns: ["id", "createdAt", "updatedAt"]
  },
  {
    name: "memberSession",
    table: "MemberSession",
    idColumn: "id",
    columns: [
      "id",
      "expiresAt",
      "revokedAt",
      "lastSeenAt",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "virtualPet",
    table: "VirtualPet",
    idColumn: "id",
    columns: [
      "id",
      "petNo",
      "species",
      "homepageShowGrowthArchive",
      "homepageShowMallRecommendations",
      "mood",
      "energy",
      "intimacy",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "virtualPetEvent",
    table: "VirtualPetEvent",
    idColumn: "id",
    columns: ["id", "petId", "type", "createdAt"]
  },
  {
    name: "virtualPetTaskCompletion",
    table: "VirtualPetTaskCompletion",
    idColumn: "id",
    columns: [
      "id",
      "petId",
      "petNo",
      "taskKey",
      "completedDate",
      "createdAt"
    ]
  },
  {
    name: "virtualPetHomepageVisit",
    table: "VirtualPetHomepageVisit",
    idColumn: "id",
    columns: ["id", "petId", "petNo", "source", "visitDate", "createdAt"]
  },
  {
    name: "growthTaskTemplate",
    table: "CloudPetGrowthTaskTemplate",
    idColumn: "key",
    columns: [
      "key",
      "points",
      "rewardMood",
      "rewardEnergy",
      "rewardIntimacy",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "careScoreConfig",
    table: "CloudPetCareScoreConfig",
    idColumn: "id",
    columns: [
      "id",
      "dailyTaskBonus",
      "steadyMinScore",
      "thrivingMinScore",
      "thrivingRequiresCareToday",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "communityPost",
    table: "CommunityPost",
    idColumn: "id",
    columns: [
      "id",
      "postNo",
      "petId",
      "petNo",
      "status",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "communityComment",
    table: "CommunityComment",
    idColumn: "id",
    columns: [
      "id",
      "commentNo",
      "postId",
      "postNo",
      "status",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "communityLike",
    table: "CommunityLike",
    idColumn: "id",
    columns: ["id", "postId", "postNo", "createdAt"]
  },
  {
    name: "communityFollow",
    table: "CommunityFollow",
    idColumn: "id",
    columns: ["id", "petId", "petNo", "createdAt"]
  },
  {
    name: "communityReport",
    table: "CommunityReport",
    idColumn: "id",
    columns: [
      "id",
      "reportNo",
      "postId",
      "postNo",
      "status",
      "createdAt",
      "updatedAt",
      "resolvedAt"
    ]
  },
  {
    name: "operationLog",
    table: "OperationLog",
    idColumn: "id",
    columns: [
      "id",
      "logNo",
      "staffNo",
      "role",
      "action",
      "targetType",
      "targetId",
      "createdAt"
    ]
  },
  {
    name: "adminStaffAccount",
    table: "AdminStaffAccount",
    idColumn: "id",
    columns: [
      "id",
      "staffNo",
      "role",
      "status",
      "lastLoginAt",
      "createdAt",
      "updatedAt"
    ]
  },
  {
    name: "adminStaffSession",
    table: "AdminStaffSession",
    idColumn: "id",
    columns: [
      "id",
      "staffId",
      "expiresAt",
      "revokedAt",
      "lastSeenAt",
      "createdAt"
    ]
  }
];

const DOMAIN_NAMES = DOMAIN_DEFINITIONS.map(({ name }) => name);

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Buffer.isBuffer(value)) {
    return value.toString("hex");
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry ?? null)])
    );
  }
  return value ?? null;
}

export function hashCanonicalRows(name: string, rows: unknown[]): CountHash {
  const hash = createHash("sha256");
  hash.update(`manifest-v1\n${name}\n`);
  for (const row of rows) {
    hash.update(`${JSON.stringify(canonicalize(row))}\n`);
  }
  return { count: rows.length, hash: hash.digest("hex") };
}

function decodeSqlitePath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    throw new SqliteRecoveryError(
      "INVALID_DATABASE_URL",
      "SQLite database URL is malformed",
      undefined,
      { cause: error }
    );
  }
}

export function resolveSqliteDatabasePath(
  databaseUrl: string | undefined,
  schemaPath = resolve(process.cwd(), "prisma/schema.prisma")
): string {
  if (!databaseUrl?.startsWith("file:")) {
    throw new SqliteRecoveryError(
      "INVALID_DATABASE_URL",
      "DATABASE_URL must use file-based SQLite"
    );
  }

  const rawPath = decodeSqlitePath(databaseUrl.slice("file:".length));
  if (
    !rawPath ||
    rawPath.includes("\0") ||
    rawPath.includes("?") ||
    rawPath.includes("#") ||
    rawPath === ":memory:" ||
    rawPath.includes("mode=memory")
  ) {
    throw new SqliteRecoveryError(
      "INVALID_DATABASE_URL",
      "DATABASE_URL must point to a SQLite file"
    );
  }

  const windowsAbsolute = win32.isAbsolute(rawPath.replace(/^\//, ""));
  if (windowsAbsolute) {
    return win32.normalize(rawPath.replace(/^\//, ""));
  }
  if (isAbsolute(rawPath)) {
    return resolve(rawPath);
  }
  return resolve(dirname(schemaPath), rawPath);
}

export function escapeSqliteStringLiteral(value: string): string {
  if (value.includes("\0")) {
    throw new SqliteRecoveryError(
      "UNSAFE_OUTPUT_PATH",
      "SQLite output path is invalid"
    );
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function sqliteDatabaseUrl(filePath: string): string {
  return `file:${filePath.replaceAll("\\", "/")}`;
}

function createPrismaClient(filePath: string): PrismaClient {
  return new PrismaClient({ datasourceUrl: sqliteDatabaseUrl(filePath) });
}

async function collectDefinition(
  prisma: PrismaClient,
  definition: DomainDefinition
): Promise<CountHash> {
  const selectedColumns = definition.columns.map(quoteIdentifier).join(", ");
  const table = quoteIdentifier(definition.table);
  const idColumn = quoteIdentifier(definition.idColumn);
  const hash = createHash("sha256");
  hash.update(`manifest-v1\n${definition.name}\n`);
  let count = 0;
  let cursor = "";

  while (true) {
    const page = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${selectedColumns} FROM ${table} WHERE ${idColumn} > ? ORDER BY ${idColumn} ASC LIMIT ${PAGE_SIZE}`,
      cursor
    );
    for (const row of page) {
      hash.update(`${JSON.stringify(canonicalize(row))}\n`);
      count += 1;
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
    const nextCursor = page.at(-1)?.[definition.idColumn];
    if (typeof nextCursor !== "string" || nextCursor <= cursor) {
      throw new SqliteRecoveryError(
        "UNEXPECTED_ERROR",
        "Unable to paginate recovery domain"
      );
    }
    cursor = nextCursor;
  }

  return { count, hash: hash.digest("hex") };
}

async function collectMigrations(prisma: PrismaClient): Promise<CountHash> {
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT "migration_name", "checksum", "finished_at", "rolled_back_at", "applied_steps_count"
     FROM "_prisma_migrations"
     ORDER BY "migration_name" ASC`
  );
  const unfinished = rows.some(
    (row) => row.finished_at === null && row.rolled_back_at === null
  );
  if (unfinished) {
    throw new SqliteRecoveryError(
      "MIGRATION_STATE_INVALID",
      "SQLite migration state is incomplete"
    );
  }
  return hashCanonicalRows("migrations", rows);
}

export async function collectSqliteRecoverySnapshot(
  prisma: PrismaClient
): Promise<SqliteRecoverySnapshot> {
  const migrations = await collectMigrations(prisma);
  const entries: [keyof RecoveryDomains, CountHash][] = [];
  for (const definition of DOMAIN_DEFINITIONS) {
    entries.push([definition.name, await collectDefinition(prisma, definition)]);
  }
  return {
    migrations,
    domains: Object.fromEntries(entries) as RecoveryDomains
  };
}

async function assertQuickCheck(
  prisma: PrismaClient,
  errorCode: "BACKUP_QUICK_CHECK_FAILED" | "RESTORE_QUICK_CHECK_FAILED"
): Promise<void> {
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      "PRAGMA quick_check"
    );
    if (
      rows.length !== 1 ||
      String(Object.values(rows[0] ?? {})[0]).toLowerCase() !== "ok"
    ) {
      throw new Error("quick_check did not return ok");
    }
  } catch (error) {
    throw new SqliteRecoveryError(
      errorCode,
      "SQLite integrity check failed",
      undefined,
      { cause: error }
    );
  }
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

async function assertPathDoesNotExist(filePath: string): Promise<void> {
  try {
    await access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return;
    }
    throw new SqliteRecoveryError(
      "UNSAFE_OUTPUT_PATH",
      "Generated backup target cannot be checked",
      undefined,
      { cause: error }
    );
  }
  throw new SqliteRecoveryError(
    "UNSAFE_OUTPUT_PATH",
    "Generated backup target already exists"
  );
}

function snapshotsEqual(
  expected: SqliteRecoverySnapshot,
  actual: SqliteRecoverySnapshot
): boolean {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function assertCountHash(value: unknown): asserts value is CountHash {
  const candidate = value as Partial<CountHash> | null;
  if (
    !candidate ||
    !Number.isSafeInteger(candidate.count) ||
    Number(candidate.count) < 0 ||
    typeof candidate.hash !== "string" ||
    !HASH_PATTERN.test(candidate.hash)
  ) {
    throw new SqliteRecoveryError("MANIFEST_INVALID", "Manifest is invalid");
  }
}

export function assertSqliteRecoveryManifest(
  value: unknown
): asserts value is SqliteRecoveryManifest {
  const manifest = value as Partial<SqliteRecoveryManifest> | null;
  if (
    !manifest ||
    manifest.schemaVersion !== SQLITE_RECOVERY_SCHEMA_VERSION ||
    typeof manifest.createdAt !== "string" ||
    Number.isNaN(Date.parse(manifest.createdAt)) ||
    typeof manifest.backupFile !== "string" ||
    manifest.backupFile !== basename(manifest.backupFile) ||
    manifest.backupFile.includes("..") ||
    manifest.backupFile.includes("/") ||
    manifest.backupFile.includes("\\") ||
    manifest.backupFile.includes("\0") ||
    !manifest.backupFile.endsWith(".sqlite") ||
    !Number.isSafeInteger(manifest.backupSizeBytes) ||
    Number(manifest.backupSizeBytes) < 1 ||
    typeof manifest.backupSha256 !== "string" ||
    !HASH_PATTERN.test(manifest.backupSha256) ||
    manifest.sqlite?.quickCheck !== "ok" ||
    !manifest.domains ||
    Object.keys(manifest.domains).length !== DOMAIN_NAMES.length
  ) {
    throw new SqliteRecoveryError("MANIFEST_INVALID", "Manifest is invalid");
  }

  assertCountHash(manifest.migrations);
  for (const domainName of DOMAIN_NAMES) {
    assertCountHash(manifest.domains[domainName]);
  }
}

function timestampForFile(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, "");
}

async function ensureSourceDatabase(
  databaseUrl: string | undefined,
  schemaPath: string
): Promise<string> {
  const configuredPath = resolveSqliteDatabasePath(databaseUrl, schemaPath);
  try {
    const resolvedPath = await realpath(configuredPath);
    const sourceStat = await stat(resolvedPath);
    if (!sourceStat.isFile()) {
      throw new Error("not a file");
    }
    return resolvedPath;
  } catch (error) {
    if (error instanceof SqliteRecoveryError) {
      throw error;
    }
    throw new SqliteRecoveryError(
      "SOURCE_DATABASE_NOT_FOUND",
      "SQLite source database was not found",
      undefined,
      { cause: error }
    );
  }
}

async function ensureOutputDirectory(outputDirectory: string): Promise<string> {
  if (!outputDirectory || outputDirectory.includes("\0")) {
    throw new SqliteRecoveryError(
      "UNSAFE_OUTPUT_PATH",
      "Backup output directory is invalid"
    );
  }
  const target = resolve(outputDirectory);
  await mkdir(target, { recursive: true, mode: 0o700 });
  return realpath(target);
}

export async function createSqliteBackup(options: {
  outputDirectory: string;
  databaseUrl?: string;
  schemaPath?: string;
  now?: Date;
}): Promise<{
  backupPath: string;
  manifestPath: string;
  manifest: SqliteRecoveryManifest;
}> {
  const schemaPath = options.schemaPath ?? resolve(process.cwd(), "prisma/schema.prisma");
  const sourcePath = await ensureSourceDatabase(
    options.databaseUrl ?? process.env.DATABASE_URL,
    schemaPath
  );
  const outputDirectory = await ensureOutputDirectory(options.outputDirectory);
  const suffix = randomBytes(4).toString("hex");
  const baseName = `cloud-pets-${timestampForFile(options.now ?? new Date())}-${suffix}`;
  const backupFile = `${baseName}.sqlite`;
  const manifestFile = `${baseName}.manifest.json`;
  const backupPath = join(outputDirectory, backupFile);
  const manifestPath = join(outputDirectory, manifestFile);
  const temporaryBackupPath = join(outputDirectory, `.${backupFile}.tmp`);
  const temporaryManifestPath = join(outputDirectory, `.${manifestFile}.tmp`);
  let published = false;
  let backupPublished = false;
  let manifestPublished = false;
  let sourceClient: PrismaClient | undefined;
  let backupClient: PrismaClient | undefined;

  if (sourcePath === backupPath || sourcePath === temporaryBackupPath) {
    throw new SqliteRecoveryError(
      "UNSAFE_OUTPUT_PATH",
      "Backup target cannot be the source database"
    );
  }

  try {
    await Promise.all(
      [backupPath, manifestPath, temporaryBackupPath, temporaryManifestPath].map(
        (path) => assertPathDoesNotExist(path)
      )
    );

    sourceClient = createPrismaClient(sourcePath);
    const sourceSnapshot = await collectSqliteRecoverySnapshot(sourceClient);
    try {
      await sourceClient.$executeRawUnsafe(
        `VACUUM INTO ${escapeSqliteStringLiteral(temporaryBackupPath)}`
      );
    } catch (error) {
      throw new SqliteRecoveryError(
        "VACUUM_INTO_FAILED",
        "SQLite backup creation failed",
        undefined,
        { cause: error }
      );
    }

    backupClient = createPrismaClient(temporaryBackupPath);
    await assertQuickCheck(backupClient, "BACKUP_QUICK_CHECK_FAILED");
    const backupSnapshot = await collectSqliteRecoverySnapshot(backupClient);
    if (!snapshotsEqual(sourceSnapshot, backupSnapshot)) {
      throw new SqliteRecoveryError(
        "DOMAIN_MISMATCH",
        "Source changed while the SQLite backup was being created"
      );
    }
    await backupClient.$disconnect();
    backupClient = undefined;

    const backupStats = await stat(temporaryBackupPath);
    const manifest: SqliteRecoveryManifest = {
      schemaVersion: SQLITE_RECOVERY_SCHEMA_VERSION,
      createdAt: (options.now ?? new Date()).toISOString(),
      backupFile,
      backupSizeBytes: backupStats.size,
      backupSha256: await sha256File(temporaryBackupPath),
      sqlite: { quickCheck: "ok" },
      ...backupSnapshot
    };

    try {
      await writeFile(
        temporaryManifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        { flag: "wx", mode: 0o600 }
      );
      await chmod(temporaryBackupPath, 0o600);
      await link(temporaryBackupPath, backupPath);
      backupPublished = true;
      await rm(temporaryBackupPath);
      await link(temporaryManifestPath, manifestPath);
      manifestPublished = true;
      await rm(temporaryManifestPath);
    } catch (error) {
      throw new SqliteRecoveryError(
        "BACKUP_MANIFEST_WRITE_FAILED",
        "SQLite backup manifest could not be published",
        undefined,
        { cause: error }
      );
    }
    published = true;
    return { backupPath, manifestPath, manifest };
  } finally {
    await Promise.allSettled([
      sourceClient?.$disconnect(),
      backupClient?.$disconnect()
    ]);
    if (!published) {
      await Promise.allSettled(
        [
          temporaryBackupPath,
          temporaryManifestPath,
          ...(backupPublished ? [backupPath] : []),
          ...(manifestPublished ? [manifestPath] : [])
        ].map((path) => rm(path, { force: true }))
      );
    }
  }
}

function compareCountHash(
  expected: CountHash,
  actual: CountHash
): boolean {
  return expected.count === actual.count && expected.hash === actual.hash;
}

export async function runSqliteRestoreDrill(options: {
  manifestPath: string;
  keepTemporaryDirectory?: boolean;
}): Promise<{
  manifest: SqliteRecoveryManifest;
  temporaryDirectory?: string;
}> {
  let manifestPath: string;
  try {
    manifestPath = await realpath(resolve(options.manifestPath));
  } catch (error) {
    throw new SqliteRecoveryError(
      "MANIFEST_INVALID",
      "Manifest was not found",
      undefined,
      { cause: error }
    );
  }

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    throw new SqliteRecoveryError(
      "MANIFEST_INVALID",
      "Manifest is invalid",
      undefined,
      { cause: error }
    );
  }
  assertSqliteRecoveryManifest(manifestValue);
  const manifest = manifestValue;
  const manifestDirectory = dirname(manifestPath);
  const expectedBackupPath = join(manifestDirectory, manifest.backupFile);
  let backupPath: string;
  try {
    backupPath = await realpath(expectedBackupPath);
  } catch (error) {
    throw new SqliteRecoveryError(
      "BACKUP_NOT_FOUND",
      "Manifest backup file was not found",
      undefined,
      { cause: error }
    );
  }
  const pathFromManifest = relative(manifestDirectory, backupPath);
  if (
    pathFromManifest.startsWith("..") ||
    isAbsolute(pathFromManifest) ||
    dirname(pathFromManifest) !== "."
  ) {
    throw new SqliteRecoveryError(
      "MANIFEST_INVALID",
      "Manifest backup path is unsafe"
    );
  }

  const backupStats = await stat(backupPath);
  const backupSha256 = await sha256File(backupPath);
  if (
    backupStats.size !== manifest.backupSizeBytes ||
    backupSha256 !== manifest.backupSha256
  ) {
    throw new SqliteRecoveryError(
      "BACKUP_SHA_MISMATCH",
      "Backup file verification failed"
    );
  }

  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "cloud-pets-restore-drill-")
  );
  const restoredPath = join(temporaryDirectory, "restored.sqlite");
  let restoredClient: PrismaClient | undefined;
  try {
    await copyFile(backupPath, restoredPath);
    restoredClient = createPrismaClient(restoredPath);
    await assertQuickCheck(restoredClient, "RESTORE_QUICK_CHECK_FAILED");
    const restoredSnapshot = await collectSqliteRecoverySnapshot(restoredClient);
    if (!compareCountHash(manifest.migrations, restoredSnapshot.migrations)) {
      throw new SqliteRecoveryError(
        "MIGRATION_MISMATCH",
        "Restored migration state does not match the manifest",
        {
          expected: manifest.migrations,
          actual: restoredSnapshot.migrations
        }
      );
    }
    for (const domainName of DOMAIN_NAMES) {
      if (
        !compareCountHash(
          manifest.domains[domainName],
          restoredSnapshot.domains[domainName]
        )
      ) {
        throw new SqliteRecoveryError(
          "DOMAIN_MISMATCH",
          "Restored domain does not match the manifest",
          {
            domain: domainName,
            expected: manifest.domains[domainName],
            actual: restoredSnapshot.domains[domainName]
          }
        );
      }
    }
    return {
      manifest,
      temporaryDirectory: options.keepTemporaryDirectory
        ? temporaryDirectory
        : undefined
    };
  } finally {
    await restoredClient?.$disconnect();
    if (!options.keepTemporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

function getRestoreDrillAttestationPath(manifestPath: string): string {
  const manifestFile = basename(manifestPath);
  const baseName = manifestFile.endsWith(".manifest.json")
    ? manifestFile.slice(0, -".manifest.json".length)
    : manifestFile;
  return join(dirname(manifestPath), `${baseName}.restore-check.json`);
}

async function readManifestForAttestation(manifestPath: string) {
  const resolvedManifestPath = await realpath(resolve(manifestPath));
  const manifestText = await readFile(resolvedManifestPath, "utf8");
  const manifestValue: unknown = JSON.parse(manifestText);
  assertSqliteRecoveryManifest(manifestValue);
  return {
    manifestPath: resolvedManifestPath,
    manifest: manifestValue,
    manifestSha256: await sha256File(resolvedManifestPath)
  };
}

export async function writeSqliteRestoreDrillAttestation(options: {
  manifestPath: string;
  status: "passed" | "failed";
  checkedAt?: string;
  failureCode?: SqliteRecoveryErrorCode;
}): Promise<{ path: string; attestation: SqliteRestoreDrillAttestation }> {
  const { manifestPath, manifestSha256 } = await readManifestForAttestation(
    options.manifestPath
  );
  const attestation: SqliteRestoreDrillAttestation = {
    schemaVersion: SQLITE_RESTORE_DRILL_ATTESTATION_SCHEMA_VERSION,
    manifestFile: basename(manifestPath),
    manifestSha256,
    checkedAt: options.checkedAt ?? new Date().toISOString(),
    status: options.status,
    ...(options.status === "failed" && options.failureCode
      ? { failureCode: options.failureCode }
      : {})
  };
  const path = getRestoreDrillAttestationPath(manifestPath);
  await writeFile(path, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
  return { path, attestation };
}

export async function runSqliteRestoreDrillWithAttestation(options: {
  manifestPath: string;
  keepTemporaryDirectory?: boolean;
}): Promise<Awaited<ReturnType<typeof runSqliteRestoreDrill>>> {
  try {
    const result = await runSqliteRestoreDrill(options);
    await writeSqliteRestoreDrillAttestation({
      manifestPath: options.manifestPath,
      status: "passed"
    }).catch(() => undefined);
    return result;
  } catch (error) {
    const recoveryError = asSqliteRecoveryError(error);
    await writeSqliteRestoreDrillAttestation({
      manifestPath: options.manifestPath,
      status: "failed",
      failureCode: recoveryError.code
    }).catch(() => undefined);
    throw error;
  }
}

export function asSqliteRecoveryError(error: unknown): SqliteRecoveryError {
  if (error instanceof SqliteRecoveryError) {
    return error;
  }
  return new SqliteRecoveryError(
    "UNEXPECTED_ERROR",
    "Unexpected SQLite recovery failure",
    undefined,
    { cause: error }
  );
}
