import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OrdersModule } from "../orders/orders.module";
import { AfterSalesController } from "./after-sales.controller";
import { AfterSalesService } from "./after-sales.service";

@Module({
  imports: [DatabaseModule, OrdersModule],
  controllers: [AfterSalesController],
  providers: [AfterSalesService],
  exports: [AfterSalesService]
})
export class AfterSalesModule {}
