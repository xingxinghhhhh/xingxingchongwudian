import { randomBytes, scryptSync } from "node:crypto";

export const ADMIN_OWNER_STAFF_NO = "STAFF_OWNER";

export const ADMIN_OWNER_PERMISSIONS = [
  "audit:read",
  "catalog:write",
  "customers:write",
  "cms:write",
  "cloud_pets:write",
  "community:moderate",
  "fulfillment:write",
  "marketing:write",
  "reviews:moderate",
  "refunds:write"
] as const;

type AdminStaffAccountDelegate = {
  findFirst(args: { where: { role: string } }): Promise<unknown>;
  findUnique(args: {
    where: { staffNo?: string; email?: string };
  }): Promise<unknown>;
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
};

export type AdminOwnerBootstrapPrisma = {
  adminStaffAccount: AdminStaffAccountDelegate;
  $transaction<T>(
    callback: (transaction: {
      adminStaffAccount: AdminStaffAccountDelegate;
    }) => Promise<T>
  ): Promise<T>;
};

export type AdminOwnerBootstrapInput = {
  name?: string;
  email: string;
  password: string;
};

export type AdminOwnerBootstrapResult = {
  staffNo: string;
  name: string;
  email: string;
  role: "owner";
};

function normalizeInput(input: AdminOwnerBootstrapInput) {
  const name = input.name?.trim() || "System Owner";
  const email = input.email.trim().toLowerCase();

  if (!name || name.length > 80) {
    throw new Error("ADMIN_OWNER_NAME must contain 1 to 80 characters");
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("ADMIN_OWNER_EMAIL must be a valid email address");
  }

  if (
    input.password.length < 12 ||
    input.password === "owner123456" ||
    input.password.toLowerCase().includes("password")
  ) {
    throw new Error(
      "ADMIN_OWNER_PASSWORD must contain at least 12 non-default characters"
    );
  }

  return { name, email, password: input.password };
}

export async function bootstrapAdminOwner(
  prisma: AdminOwnerBootstrapPrisma,
  input: AdminOwnerBootstrapInput
): Promise<AdminOwnerBootstrapResult> {
  const normalized = normalizeInput(input);

  return prisma.$transaction(async (transaction) => {
    const existingOwner = await transaction.adminStaffAccount.findFirst({
      where: { role: "owner" }
    });

    if (existingOwner) {
      throw new Error("An admin owner already exists; bootstrap is one-time");
    }

    const existingStaffNo = await transaction.adminStaffAccount.findUnique({
      where: { staffNo: ADMIN_OWNER_STAFF_NO }
    });

    if (existingStaffNo) {
      throw new Error(`${ADMIN_OWNER_STAFF_NO} is already in use`);
    }

    const existingEmail = await transaction.adminStaffAccount.findUnique({
      where: { email: normalized.email }
    });

    if (existingEmail) {
      throw new Error("ADMIN_OWNER_EMAIL is already in use");
    }

    await transaction.adminStaffAccount.create({
      data: {
        staffNo: ADMIN_OWNER_STAFF_NO,
        name: normalized.name,
        email: normalized.email,
        passwordHash: hashPassword(normalized.password),
        role: "owner",
        permissions: [...ADMIN_OWNER_PERMISSIONS],
        status: "active"
      }
    });

    return {
      staffNo: ADMIN_OWNER_STAFF_NO,
      name: normalized.name,
      email: normalized.email,
      role: "owner"
    };
  });
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

const hashPassword = hashAdminPassword;
