import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL?.trim();
const ownerEmail = process.env.ADMIN_OWNER_EMAIL?.trim();
const ownerPassword = process.env.ADMIN_OWNER_PASSWORD;

if (!databaseUrl) {
  console.error("ADMIN_OWNER_BOOTSTRAP_FAILED: DATABASE_URL is required");
  process.exitCode = 1;
} else if (!ownerEmail || !ownerPassword) {
  console.error(
    "ADMIN_OWNER_BOOTSTRAP_FAILED: ADMIN_OWNER_EMAIL and ADMIN_OWNER_PASSWORD are required"
  );
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const { bootstrapAdminOwner } = await import(
      "../dist/admin-auth/admin-owner-bootstrap.js"
    );
    const result = await bootstrapAdminOwner(prisma, {
      name: process.env.ADMIN_OWNER_NAME,
      email: ownerEmail,
      password: ownerPassword
    });
    console.log(JSON.stringify({ ok: true, code: "ADMIN_OWNER_BOOTSTRAPPED", ...result }));
  } catch (error) {
    console.error(
      JSON.stringify({
        ok: false,
        code: "ADMIN_OWNER_BOOTSTRAP_FAILED",
        message: error instanceof Error ? error.message : "Unexpected bootstrap failure"
      })
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
