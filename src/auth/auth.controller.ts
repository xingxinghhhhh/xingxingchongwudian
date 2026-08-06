import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginMemberDto } from "./dto/login-member.dto";
import { RequestMemberVerificationDto } from "./dto/request-member-verification.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("verification-codes")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  requestVerification(@Body() dto: RequestMemberVerificationDto) {
    return this.authService.requestVerification(dto);
  }

  @Post("login")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 10 * 60_000 } })
  login(@Body() dto: LoginMemberDto) {
    return this.authService.login(dto);
  }

  @Post("logout")
  logout(@Req() request: Request) {
    return this.authService.logout(request.header("x-member-token"));
  }
}
