import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { AdminAuthService } from "./admin-auth.service";
import { LoginAdminDto } from "./dto/login-admin.dto";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post("login")
  login(@Body() dto: LoginAdminDto) {
    return this.adminAuthService.login(dto);
  }

  @Post("logout")
  logout(@Req() request: Request) {
    return this.adminAuthService.logout(request.header("x-admin-session"));
  }

  @Get("me")
  me(@Req() request: Request) {
    return this.adminAuthService.getSession(request.header("x-admin-session"));
  }
}
