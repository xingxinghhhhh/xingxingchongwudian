import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import {
  Injectable,
  OnModuleInit,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import {
  AdminPermission,
  AdminStaff,
  StaffService
} from "../staff/staff.service";
import { LoginAdminDto } from "./dto/login-admin.dto";

interface AdminStaffAccount {
  id: string;
  staffNo: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  permissions?: unknown;
  status: string;
  lastLoginAt?: Date | string | null;
  createdAt: Date | string;
}

interface AdminSessionRecord {
  sessionToken: string;
  staff: AdminStaff;
  createdAt: string;
  lastSeenAt: string;
}

const OWNER_PERMISSIONS: AdminPermission[] = [
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
];

const OPERATOR_PERMISSIONS: AdminPermission[] = [
  "community:moderate",
  "fulfillment:write",
  "refunds:write",
  "reviews:moderate"
];

const ALL_PERMISSIONS = new Set<AdminPermission>([
  ...OWNER_PERMISSIONS,
  ...OPERATOR_PERMISSIONS
]);

@Injectable()
export class AdminAuthService implements OnModuleInit {
  private readonly sessions = new Map<string, AdminSessionRecord>();
  private readonly staffAccounts: AdminStaffAccount[];
  private sequence = 0;

  constructor(
    private readonly staffService: StaffService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    this.staffAccounts = this.createSeededAccounts();
  }

  async onModuleInit() {
    if (!this.usesPersistentAuth()) {
      return;
    }

    await this.prisma.adminStaffAccount.upsert({
      where: { staffNo: "STAFF_OWNER" },
      create: {
        staffNo: "STAFF_OWNER",
        name:
          this.configService.get<string>("ADMIN_OWNER_NAME")?.trim() ||
          "System Owner",
        email: this.requiredConfig("ADMIN_OWNER_EMAIL").toLowerCase(),
        passwordHash: this.hashPassword(
          this.requiredConfig("ADMIN_OWNER_PASSWORD")
        ),
        role: "owner",
        permissions: OWNER_PERMISSIONS,
        status: "active"
      },
      update: {
        name:
          this.configService.get<string>("ADMIN_OWNER_NAME")?.trim() ||
          "System Owner",
        email: this.requiredConfig("ADMIN_OWNER_EMAIL").toLowerCase(),
        passwordHash: this.hashPassword(
          this.requiredConfig("ADMIN_OWNER_PASSWORD")
        ),
        role: "owner",
        permissions: OWNER_PERMISSIONS
      }
    });
  }

  async login(dto: LoginAdminDto) {
    const email = dto.email.trim().toLowerCase();
    const account = this.usesPersistentAuth()
      ? await this.prisma.adminStaffAccount.findUnique({ where: { email } })
      : this.staffAccounts.find((item) => item.email.toLowerCase() === email);

    if (!account || !this.verifyPassword(dto.password, account.passwordHash)) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    if (account.status !== "active") {
      throw new UnauthorizedException("Admin account is disabled");
    }

    const staff = this.toStaffProfile(account);
    const sessionToken = this.createSessionToken();
    const now = new Date();

    if (this.usesPersistentAuth()) {
      await this.prisma.$transaction([
        this.prisma.adminStaffAccount.update({
          where: { id: account.id },
          data: { lastLoginAt: now }
        }),
        this.prisma.adminStaffSession.create({
          data: {
            token: sessionToken,
            staffId: account.id,
            expiresAt: new Date(
              now.getTime() + this.getSessionTtlHours() * 60 * 60 * 1_000
            ),
            lastSeenAt: now
          }
        })
      ]);
    } else {
      account.lastLoginAt = now.toISOString();
      this.sessions.set(sessionToken, {
        sessionToken,
        staff,
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString()
      });
    }

    const sessionAuditId = this.createSessionAuditId(sessionToken);
    await this.staffService.recordOperation(staff, {
      action: "security.admin_login",
      targetType: "admin_session",
      targetId: sessionAuditId,
      summary: `Admin staff ${staff.staffNo} signed in via session ${sessionAuditId}`
    });

    return {
      sessionToken,
      staff
    };
  }

  async logout(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid admin session");
    }

    if (this.usesPersistentAuth()) {
      const session = await this.prisma.adminStaffSession.findUnique({
        where: { token: sessionToken },
        include: { staff: true }
      });

      if (session && !session.revokedAt) {
        await this.prisma.adminStaffSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() }
        });
        const staff = this.toStaffProfile(session.staff);
        const sessionAuditId = this.createSessionAuditId(sessionToken);
        await this.staffService.recordOperation(staff, {
          action: "security.admin_logout",
          targetType: "admin_session",
          targetId: sessionAuditId,
          summary: `Admin staff ${staff.staffNo} signed out from session ${sessionAuditId}`
        });
      }

      return { success: true };
    }

    const memorySession = this.sessions.get(sessionToken);
    if (memorySession) {
      const sessionAuditId = this.createSessionAuditId(sessionToken);
      await this.staffService.recordOperation(memorySession.staff, {
        action: "security.admin_logout",
        targetType: "admin_session",
        targetId: sessionAuditId,
        summary: `Admin staff ${memorySession.staff.staffNo} signed out from session ${sessionAuditId}`
      });
    }

    this.sessions.delete(sessionToken);
    return { success: true };
  }

  async getSession(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid admin session");
    }

    if (this.usesPersistentAuth()) {
      const session = await this.prisma.adminStaffSession.findUnique({
        where: { token: sessionToken },
        include: { staff: true }
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        session.staff.status !== "active"
      ) {
        throw new UnauthorizedException("Invalid admin session");
      }

      if (Date.now() - session.lastSeenAt.getTime() >= 60_000) {
        await this.prisma.adminStaffSession.update({
          where: { id: session.id },
          data: { lastSeenAt: new Date() }
        });
      }

      return this.toStaffProfile(session.staff);
    }

    const session = this.sessions.get(sessionToken);

    if (!session) {
      throw new UnauthorizedException("Invalid admin session");
    }

    session.lastSeenAt = new Date().toISOString();
    return session.staff;
  }

  private createSeededAccounts(): AdminStaffAccount[] {
    return [
      {
        id: "staff_owner_id",
        staffNo: "STAFF_OWNER",
        name: "Owner Admin",
        email: "owner@example.com",
        passwordHash: this.hashPassword("owner123456"),
        role: "owner",
        status: "active",
        createdAt: "2026-06-03T00:00:00.000Z"
      },
      {
        id: "staff_operator_id",
        staffNo: "STAFF_OPS",
        name: "Operations Admin",
        email: "operator@example.com",
        passwordHash: this.hashPassword("operator123456"),
        role: "operator",
        status: "active",
        createdAt: "2026-06-03T00:00:00.000Z"
      },
      {
        id: "staff_disabled_id",
        staffNo: "STAFF_DISABLED",
        name: "Disabled Admin",
        email: "disabled@example.com",
        passwordHash: this.hashPassword("disabled123456"),
        role: "operator",
        status: "disabled",
        createdAt: "2026-06-03T00:00:00.000Z"
      }
    ];
  }

  private requiredConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(`${key} is required`);
    }

    return value;
  }

  private toStaffProfile(account: AdminStaffAccount): AdminStaff {
    const fallbackPermissions =
      account.role === "owner" ? OWNER_PERMISSIONS : OPERATOR_PERMISSIONS;
    const storedPermissions = Array.isArray(account.permissions)
      ? account.permissions.filter(
          (permission): permission is AdminPermission =>
            typeof permission === "string" &&
            ALL_PERMISSIONS.has(permission as AdminPermission)
        )
      : [];

    return {
      staffNo: account.staffNo,
      name: account.name,
      role: account.role === "owner" ? "owner" : "operator",
      permissions:
        storedPermissions.length > 0
          ? [...storedPermissions]
          : [...fallbackPermissions]
    };
  }

  private createSessionToken() {
    if (this.usesPersistentAuth()) {
      return `admin_${randomBytes(32).toString("base64url")}`;
    }

    this.sequence += 1;
    return `admin_${Date.now()}_${String(this.sequence).padStart(4, "0")}`;
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16);
    const derivedKey = scryptSync(password, salt, 64);
    return `scrypt$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
  }

  private verifyPassword(password: string, passwordHash: string) {
    const [algorithm, encodedSalt, encodedHash] = passwordHash.split("$");

    if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) {
      return false;
    }

    try {
      const expected = Buffer.from(encodedHash, "base64url");
      const actual = scryptSync(
        password,
        Buffer.from(encodedSalt, "base64url"),
        expected.length
      );
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  private createSessionAuditId(sessionToken: string) {
    return createHash("sha256").update(sessionToken).digest("hex").slice(0, 16);
  }

  private usesPersistentAuth() {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private getSessionTtlHours() {
    return Number(
      this.configService.get<string>("ADMIN_SESSION_TTL_HOURS") ?? "12"
    );
  }
}
