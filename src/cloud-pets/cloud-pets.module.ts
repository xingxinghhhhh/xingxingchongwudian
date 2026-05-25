import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { CloudPetsController } from "./cloud-pets.controller";
import { CloudPetsService } from "./cloud-pets.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CloudPetsController],
  providers: [CloudPetsService],
  exports: [CloudPetsService]
})
export class CloudPetsModule {}
