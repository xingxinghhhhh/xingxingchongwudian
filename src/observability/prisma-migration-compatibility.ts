import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { PrismaService } from "../database/prisma.service";

export type PrismaMigrationCompatibilityStatus =
  | "compatible"
  | "mismatch"
  | "unavailable";

export type PrismaMigrationCompatibility = {
  status: PrismaMigrationCompatibilityStatus;
};

type MigrationStateRow = {
  finished_at: Date | string | null;
  rolled_back_at: Date | string | null;
};

type MigrationCompatibilityDependencies = {
  databaseConfigured: boolean;
  readMigrationState: () => Promise<MigrationStateRow[]>;
  runMigrationDiff: () => Promise<number>;
};

export async function resolvePrismaMigrationCompatibility(
  dependencies: MigrationCompatibilityDependencies
): Promise<PrismaMigrationCompatibility> {
  if (!dependencies.databaseConfigured) {
    return { status: "unavailable" };
  }

  try {
    const migrationState = await dependencies.readMigrationState();
    const hasUnfinishedMigration = migrationState.some(
      (row) => row.finished_at === null && row.rolled_back_at === null
    );
    if (hasUnfinishedMigration) {
      return { status: "mismatch" };
    }

    const exitCode = await dependencies.runMigrationDiff();
    return {
      status:
        exitCode === 0
          ? "compatible"
          : exitCode === 2
            ? "mismatch"
            : "unavailable"
    };
  } catch {
    return { status: "unavailable" };
  }
}

@Injectable()
export class PrismaMigrationCompatibilityService implements OnModuleInit {
  private status: PrismaMigrationCompatibility = { status: "unavailable" };

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const databaseConfigured =
      this.configService.get<string>("NODE_ENV") === "production" &&
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"));

    this.status = await resolvePrismaMigrationCompatibility({
      databaseConfigured,
      readMigrationState: () =>
        this.prisma.$queryRawUnsafe<MigrationStateRow[]>(
          `SELECT "finished_at", "rolled_back_at" FROM "_prisma_migrations"`
        ),
      runMigrationDiff: () => this.runMigrationDiff()
    });
  }

  getStatus(): PrismaMigrationCompatibility {
    return this.status;
  }

  private runMigrationDiff(): Promise<number> {
    const rootDir = resolve(__dirname, "..", "..");
    const prismaCli = resolve(rootDir, "node_modules/prisma/build/index.js");
    const schemaPath = resolve(rootDir, "prisma/schema.prisma");
    const databaseUrl = this.configService.get<string>("DATABASE_URL");

    if (!databaseUrl) {
      return Promise.resolve(1);
    }

    return new Promise((resolveExitCode, reject) => {
      const child = spawn(
        process.execPath,
        [
          prismaCli,
          "migrate",
          "diff",
          "--from-url",
          databaseUrl,
          "--to-schema-datamodel",
          schemaPath,
          "--exit-code"
        ],
        {
          cwd: rootDir,
          env: process.env,
          windowsHide: true,
          stdio: "ignore"
        }
      );

      child.once("error", reject);
      child.once("exit", (code) => resolveExitCode(code ?? 1));
    });
  }
}
