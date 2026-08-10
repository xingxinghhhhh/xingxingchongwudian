import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  collectSqliteRecoverySnapshot,
  createSqliteBackup,
  runSqliteRestoreDrillWithAttestation
} from "../src/operations/sqlite-recovery";

const rootDirectory = resolve(__dirname, "..");
const schemaPath = resolve(rootDirectory, "prisma/schema.prisma");
const prismaCli = resolve(rootDirectory, "node_modules/prisma/build/index.js");

function databaseUrl(databasePath: string): string {
  return `file:${databasePath.replaceAll("\\", "/")}`;
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: rootDirectory,
      env,
      windowsHide: true
    });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", () => undefined);
    child.once("error", rejectRun);
    child.once("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`Recovery smoke migration failed (${code})`));
      }
    });
  });
}

async function seedRepresentativeData(prisma: PrismaClient): Promise<void> {
  const expiresAt = new Date("2026-08-03T00:00:00.000Z");
  await prisma.customer.create({
    data: {
      id: "recovery-customer",
      phone: "18800009999",
      name: "Recovery Smoke Member",
      sourcePlatform: "recovery-smoke"
    }
  });
  await prisma.memberSession.create({
    data: {
      id: "recovery-member-session",
      token: "recovery-member-session-secret",
      phone: "18800009999",
      name: "Recovery Smoke Member",
      expiresAt
    }
  });
  await prisma.virtualPet.createMany({
    data: [
      {
        id: "recovery-pet-1",
        petNo: "RECOVERY-PET-1",
        ownerName: "Recovery Smoke Member",
        ownerPhone: "18800009999",
        name: "Recovery One",
        species: "cat",
        personality: "private personality sentinel",
        avatarUrl: "/images/pets/cat.png",
        bio: "private bio sentinel"
      },
      {
        id: "recovery-pet-2",
        petNo: "RECOVERY-PET-2",
        ownerName: "Recovery Smoke Member",
        ownerPhone: "18800009999",
        name: "Recovery Two",
        species: "dog",
        personality: "private personality two",
        avatarUrl: "/images/pets/dog.png",
        bio: "private bio two"
      }
    ]
  });
  await prisma.virtualPetEvent.createMany({
    data: [
      {
        id: "recovery-event-generated",
        petId: "recovery-pet-1",
        type: "daily",
        title: "private diary title sentinel",
        body: "private diary body sentinel"
      },
      {
        id: "recovery-event-owner",
        petId: "recovery-pet-1",
        type: "owner_note",
        title: "private owner note title",
        body: "private owner note body"
      }
    ]
  });
  await prisma.virtualPetTaskCompletion.create({
    data: {
      id: "recovery-task-completion",
      petId: "recovery-pet-1",
      petNo: "RECOVERY-PET-1",
      taskKey: "daily_feed",
      completedDate: "2026-08-02"
    }
  });
  await prisma.virtualPetHomepageVisit.create({
    data: {
      id: "recovery-homepage-visit",
      petId: "recovery-pet-1",
      petNo: "RECOVERY-PET-1",
      source: "share",
      visitorKey: "private-visitor-hash-sentinel",
      visitDate: "2026-08-02"
    }
  });
  await prisma.cloudPetGrowthTaskTemplate.create({
    data: {
      key: "daily_feed",
      title: "Daily feed",
      description: "Recovery smoke task",
      points: 20,
      rewardMood: 3,
      rewardEnergy: 4,
      rewardIntimacy: 2
    }
  });
  await prisma.cloudPetCareScoreConfig.create({
    data: {
      id: "default",
      dailyTaskBonus: 10,
      steadyMinScore: 45,
      thrivingMinScore: 75,
      thrivingRequiresCareToday: true
    }
  });
  await prisma.communityPost.create({
    data: {
      id: "recovery-post",
      postNo: "RECOVERY-POST-1",
      petId: "recovery-pet-1",
      petNo: "RECOVERY-PET-1",
      petName: "Recovery One",
      authorName: "private author sentinel",
      body: "private post body sentinel"
    }
  });
  await prisma.communityComment.create({
    data: {
      id: "recovery-comment",
      commentNo: "RECOVERY-COMMENT-1",
      postId: "recovery-post",
      postNo: "RECOVERY-POST-1",
      memberPhone: "18800009999",
      authorName: "private comment author",
      body: "private comment body sentinel"
    }
  });
  await prisma.communityLike.create({
    data: {
      id: "recovery-like",
      postId: "recovery-post",
      postNo: "RECOVERY-POST-1",
      memberPhone: "18800009999",
      authorName: "private like author"
    }
  });
  await prisma.communityFollow.create({
    data: {
      id: "recovery-follow",
      petId: "recovery-pet-1",
      petNo: "RECOVERY-PET-1",
      followerPhone: "18800009999",
      followerName: "private follower name"
    }
  });
  await prisma.communityReport.create({
    data: {
      id: "recovery-report",
      reportNo: "RECOVERY-REPORT-1",
      postId: "recovery-post",
      postNo: "RECOVERY-POST-1",
      memberPhone: "18800009999",
      reporterName: "private reporter name",
      reason: "private report reason sentinel"
    }
  });
  await prisma.adminStaffAccount.create({
    data: {
      id: "recovery-staff",
      staffNo: "RECOVERY-STAFF-1",
      name: "Recovery Smoke Owner",
      email: "recovery-owner@example.test",
      passwordHash: "private-password-hash-sentinel",
      role: "owner",
      permissions: ["*"]
    }
  });
  await prisma.adminStaffSession.create({
    data: {
      id: "recovery-admin-session",
      token: "private-admin-session-token-sentinel",
      staffId: "recovery-staff",
      expiresAt
    }
  });
  await prisma.operationLog.create({
    data: {
      id: "recovery-operation-log",
      logNo: "RECOVERY-LOG-1",
      staffNo: "RECOVERY-STAFF-1",
      staffName: "Recovery Smoke Owner",
      role: "owner",
      action: "cloud_pets.recovery_smoke",
      targetType: "virtual_pet",
      targetId: "recovery-pet-1",
      summary: "private operation summary sentinel"
    }
  });
}

async function main(): Promise<void> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "cloud-pets-recovery-smoke-")
  );
  const sourcePath = join(temporaryDirectory, "source.db");
  const outputDirectory = join(temporaryDirectory, "backups");
  const url = databaseUrl(sourcePath);
  const env = { ...process.env, DATABASE_URL: url };
  let prisma: PrismaClient | undefined;

  try {
    await writeFile(sourcePath, Buffer.alloc(0), { flag: "wx" });
    await mkdir(outputDirectory, { recursive: true });
    await run(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", schemaPath],
      env
    );
    prisma = new PrismaClient({ datasourceUrl: url });
    await seedRepresentativeData(prisma);

    const firstBackup = await createSqliteBackup({
      outputDirectory,
      databaseUrl: url,
      schemaPath
    });
    const secondBackup = await createSqliteBackup({
      outputDirectory,
      databaseUrl: url,
      schemaPath
    });
    if (firstBackup.backupPath === secondBackup.backupPath) {
      throw new Error("Recovery backups were not uniquely named");
    }

    const manifestText = await readFile(firstBackup.manifestPath, "utf8");
    const privateSentinels = [
      "18800009999",
      "Recovery Smoke Member",
      "private diary body sentinel",
      "private post body sentinel",
      "private report reason sentinel",
      "private-password-hash-sentinel",
      "private-admin-session-token-sentinel",
      "private-visitor-hash-sentinel",
      sourcePath
    ];
    if (privateSentinels.some((sentinel) => manifestText.includes(sentinel))) {
      throw new Error("Recovery manifest leaked private data");
    }

    await prisma.virtualPet.update({
      where: { id: "recovery-pet-1" },
      data: { mood: 99 }
    });
    await prisma.virtualPetEvent.create({
      data: {
        id: "recovery-post-backup-event",
        petId: "recovery-pet-1",
        type: "daily",
        title: "post-backup title",
        body: "post-backup body"
      }
    });
    const changedSource = await collectSqliteRecoverySnapshot(prisma);
    if (
      changedSource.domains.virtualPet.hash ===
        firstBackup.manifest.domains.virtualPet.hash ||
      changedSource.domains.virtualPetEvent.count ===
        firstBackup.manifest.domains.virtualPetEvent.count
    ) {
      throw new Error("Recovery smoke did not prove snapshot isolation");
    }

    await runSqliteRestoreDrillWithAttestation({ manifestPath: firstBackup.manifestPath });
    await runSqliteRestoreDrillWithAttestation({ manifestPath: firstBackup.manifestPath });
    await runSqliteRestoreDrillWithAttestation({ manifestPath: secondBackup.manifestPath });
    const firstAttestation = JSON.parse(
      await readFile(
        join(
          outputDirectory,
          `${basename(firstBackup.manifestPath, ".manifest.json")}.restore-check.json`
        ),
        "utf8"
      )
    ) as { manifestFile?: string; status?: string };
    if (
      firstAttestation.manifestFile !== basename(firstBackup.manifestPath) ||
      firstAttestation.status !== "passed"
    ) {
      throw new Error("Recovery drill attestation was not published safely");
    }
    console.log(
      JSON.stringify({
        ok: true,
        code: "SQLITE_RECOVERY_SMOKE_PASSED",
        backupsCreated: 2,
        restoreDrillsPassed: 3
      })
    );
  } finally {
    await prisma?.$disconnect();
    if (process.env.KEEP_SQLITE_RECOVERY_SMOKE !== "1") {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      ok: false,
      code: "SQLITE_RECOVERY_SMOKE_FAILED",
      message: error instanceof Error ? error.message : "Unexpected smoke failure"
    })
  );
  process.exitCode = 1;
});
