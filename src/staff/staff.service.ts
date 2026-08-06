import { ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { PrismaService } from "../database/prisma.service";

export type AdminRole = "owner" | "operator";

export type AdminPermission =
  | "audit:read"
  | "catalog:write"
  | "customers:write"
  | "cms:write"
  | "cloud_pets:write"
  | "community:moderate"
  | "fulfillment:write"
  | "marketing:write"
  | "reviews:moderate"
  | "refunds:write";

export interface AdminStaff {
  staffNo: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

export type AdminRequest = Request & {
  adminStaff?: AdminStaff;
};

export interface OperationLogRecord {
  logNo: string;
  staffNo: string;
  staffName: string;
  role: AdminRole;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface OperationAuditMetrics {
  operationLogCount: number;
  highRiskOperationCount: number;
  permissionDeniedCount: number;
}

interface OperationLogInput {
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
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
  "reviews:moderate",
  "refunds:write"
];

const HIGH_RISK_ACTION_PREFIXES = [
  "after_sales.",
  "catalog.",
  "cloud_pets.",
  "cms.",
  "marketing.",
  "security."
];

@Injectable()
export class StaffService {
  private readonly logs: OperationLogRecord[] = [];
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  resolveStaffByToken(token?: string, ownerToken?: string): AdminStaff | null {
    if (!token) {
      return null;
    }

    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";
    const acceptsOwnerToken =
      (ownerToken && token === ownerToken) ||
      (!isProduction && token === "dev-admin-key");

    if (acceptsOwnerToken) {
      return {
        staffNo: "STAFF_OWNER",
        name: "Owner Admin",
        role: "owner",
        permissions: OWNER_PERMISSIONS
      };
    }

    if (!isProduction && token === "ops-admin-key") {
      return {
        staffNo: "STAFF_OPS",
        name: "Operations Admin",
        role: "operator",
        permissions: OPERATOR_PERMISSIONS
      };
    }

    return null;
  }

  ensurePermission(
    staff: AdminStaff | undefined,
    permission: AdminPermission,
    context?: { method?: string; path?: string }
  ) {
    if (!staff?.permissions.includes(permission)) {
      if (staff) {
        const requestContext =
          context?.method && context?.path
            ? ` on ${context.method} ${context.path}`
            : "";
        void this.recordOperation(staff, {
          action: "security.permission_denied",
          targetType: "permission",
          targetId: permission,
          summary: `Denied ${staff.name} access to ${permission}${requestContext}`
        });
      }

      throw new ForbiddenException(`Missing admin permission: ${permission}`);
    }
  }

  async listOperationLogs(): Promise<OperationLogRecord[]> {
    if (!this.isDatabaseConfigured()) {
      return this.logs;
    }

    const logs = await this.prisma.operationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return logs.map((log) => ({
      logNo: log.logNo,
      staffNo: log.staffNo,
      staffName: log.staffName,
      role: log.role as AdminRole,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      summary: log.summary,
      createdAt: log.createdAt.toISOString()
    }));
  }

  async getOperationAuditMetrics(): Promise<OperationAuditMetrics> {
    const logs = await this.listOperationLogs();

    return {
      operationLogCount: logs.length,
      highRiskOperationCount: logs.filter((log) =>
        this.isHighRiskOperation(log.action)
      ).length,
      permissionDeniedCount: logs.filter(
        (log) => log.action === "security.permission_denied"
      ).length
    };
  }

  async recordOperation(staff: AdminStaff, input: OperationLogInput) {
    const log = {
      logNo: this.createLogNo(),
      staffNo: staff.staffNo,
      staffName: staff.name,
      role: staff.role,
      ...input,
      createdAt: new Date().toISOString()
    } satisfies OperationLogRecord;

    if (!this.isDatabaseConfigured()) {
      this.logs.unshift(log);
      return log;
    }

    const savedLog = await this.prisma.operationLog.create({
      data: {
        logNo: log.logNo,
        staffNo: log.staffNo,
        staffName: log.staffName,
        role: log.role,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        summary: log.summary
      }
    });

    return {
      ...log,
      createdAt: savedLog.createdAt.toISOString()
    };
  }

  private createLogNo() {
    this.sequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `OP${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private isHighRiskOperation(action: string) {
    return HIGH_RISK_ACTION_PREFIXES.some((prefix) =>
      action.startsWith(prefix)
    );
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }
}
