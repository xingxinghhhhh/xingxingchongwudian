import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { DatabaseModule } from "../database/database.module";
import { CommunityController } from "./community.controller";
import { CommunityService } from "./community.service";

@Module({
  imports: [
    AuthModule,
    CloudPetsModule,
    DatabaseModule
  ],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService]
})
export class CommunityModule {}
