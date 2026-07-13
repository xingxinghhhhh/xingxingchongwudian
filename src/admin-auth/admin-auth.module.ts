import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { StaffModule } from "../staff/staff.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminAuthService } from "./admin-auth.service";

@Module({
  imports: [ConfigModule, StaffModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService],
  exports: [AdminAuthService]
})
export class AdminAuthModule {}
