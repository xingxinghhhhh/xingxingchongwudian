import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ProductsModule } from "../products/products.module";
import { CloudPetsController } from "./cloud-pets.controller";
import { CloudPetsService } from "./cloud-pets.service";

@Module({
  imports: [AuthModule, DatabaseModule, ProductsModule],
  controllers: [CloudPetsController],
  providers: [CloudPetsService],
  exports: [CloudPetsService]
})
export class CloudPetsModule {}
