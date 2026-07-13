import { createHash } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminRole, AdminStaff, StaffService } from "../staff/staff.service";
import { LoginAdminDto } from "./dto/login-admin.dto";

type AdminStaffAccountStatus = "active" | "disabled";

interface AdminStaffAccount {
  id: string;
  staffNo: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  status: AdminStaffAccountStatus;
  lastLoginAt?: string;
  createdAt: string;
}

interface AdminSessionRecord {
  sessionToken: string;
  staff: AdminStaff;
  createdAt: string;
  lastSeenAt: string;
}

const OWNER_PERMISSIONS = [
  "audit:read",
  "catalog:write",
  "customers:write",
  "cms:write",
  "community:moderate",
  "fulfillment:write",
  "marketing:write",
  "reviews:moderate",
  "refunds:write"
] as const;

const OPERATOR_PERMISSIONS = [
  "community:moderate",
  "fulfillment:write",
  "refunds:write",
  "reviews:moderate"
] as const;

@Injectable()
export class AdminAuthService {
  private readonly sessions = new Map<string, AdminSessionRecord>();
  private readonly staffAccounts = this.createSeededAccounts();
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly staffService: StaffService
  ) {}

  async login(dto: LoginAdminDto) {
    const account = this.staffAccounts.find(
      (item) => item.email.toLowerCase() === dto.email.toLowerCase()
    );

    if (!account || !this.verifyPassword(dto.password, account.passwordHash)) {
      throw new UnauthorizedException("Invalid admin credentials");
    }

    if (account.status !== "active") {
      throw new UnauthorizedException("Admin account is disabled");
    }

    account.lastLoginAt = new Date().toISOString();
    const staff = this.toStaffProfile(account);
    const sessionToken = this.createSessionToken();
    this.sessions.set(sessionToken, {
      sessionToken,
      staff,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });
    await this.staffService.recordOperation(staff, {
      action: "security.admin_login",
      targetType: "admin_session",
      targetId: sessionToken,
      summary: `Admin staff ${staff.staffNo} signed in via session ${sessionToken}`
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

    const session = this.sessions.get(sessionToken);
    if (session) {
      await this.staffService.recordOperation(session.staff, {
        action: "security.admin_logout",
        targetType: "admin_session",
        targetId: sessionToken,
        summary: `Admin staff ${session.staff.staffNo} signed out from session ${sessionToken}`
      });
    }

    this.sessions.delete(sessionToken);
    return { success: true };
  }

  async getSession(sessionToken?: string) {
    if (!sessionToken) {
      throw new UnauthorizedException("Invalid admin session");
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

  private toStaffProfile(account: AdminStaffAccount): AdminStaff {
    return {
      staffNo: account.staffNo,
      name: account.name,
      role: account.role,
      permissions:
        account.role === "owner"
          ? [...OWNER_PERMISSIONS]
          : [...OPERATOR_PERMISSIONS]
    };
  }

  private createSessionToken() {
    this.sequence += 1;
    return `admin_${Date.now()}_${String(this.sequence).padStart(4, "0")}`;
  }

  private hashPassword(password: string) {
    return createHash("sha256").update(password).digest("hex");
  }

  private verifyPassword(password: string, passwordHash: string) {
    return this.hashPassword(password) === passwordHash;
  }
}
