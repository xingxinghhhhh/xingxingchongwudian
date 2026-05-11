import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class AdminTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.header("x-admin-token");
    const expectedToken =
      this.configService.get<string>("ADMIN_API_KEY") ?? "dev-admin-key";

    if (token !== expectedToken) {
      throw new UnauthorizedException("Invalid admin token");
    }

    return true;
  }
}
