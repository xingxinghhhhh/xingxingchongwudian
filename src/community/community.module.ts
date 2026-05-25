import { Module } from "@nestjs/common";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { DatabaseModule } from "../database/database.module";
import { CommunityController } from "./community.controller";
import { CommunityService } from "./community.service";

@Module({
  imports: [CloudPetsModule, DatabaseModule],
  controllers: [CommunityController],
  providers: [CommunityService]
})
export class CommunityModule {}
