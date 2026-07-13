import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { MarketingModule } from "../marketing/marketing.module";
import { PaymentsModule } from "../payments/payments.module";
import { ProductsModule } from "../products/products.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    LoyaltyModule,
    MarketingModule,
    forwardRef(() => PaymentsModule),
    ProductsModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}
