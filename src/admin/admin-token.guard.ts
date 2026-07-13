import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { AdminAuthService } from "../admin-auth/admin-auth.service";
import { StaffService } from "../staff/staff.service";

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly adminAuthService: AdminAuthService,
    private readonly staffService: StaffService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionToken = request.header("x-admin-session");
    const token = request.header("x-admin-token");
    const expectedToken =
      this.configService.get<string>("ADMIN_API_KEY") ?? "dev-admin-key";

    if (sessionToken) {
      const staff = await this.adminAuthService.getSession(sessionToken);
      Object.assign(request, { adminStaff: staff });
      return true;
    }

    const staff = this.staffService.resolveStaffByToken(token, expectedToken);

    if (!staff) {
      throw new UnauthorizedException("Invalid admin token");
    }

    Object.assign(request, { adminStaff: staff });
    return true;
  }
}
