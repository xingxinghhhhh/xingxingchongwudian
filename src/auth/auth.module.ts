import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MemberVerificationProvider } from "./member-verification.provider";

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, MemberVerificationProvider],
  exports: [AuthService]
})
export class AuthModule {}
