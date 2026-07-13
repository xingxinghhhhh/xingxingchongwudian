import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "../database/database.module";
import { StaffService } from "./staff.service";

@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [StaffService],
  exports: [StaffService]
})
export class StaffModule {}
