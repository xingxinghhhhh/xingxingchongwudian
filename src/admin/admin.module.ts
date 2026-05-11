import { Module } from "@nestjs/common";
import { OrdersModule } from "../orders/orders.module";
import { ProductsModule } from "../products/products.module";
import { AdminController } from "./admin.controller";
import { AdminTokenGuard } from "./admin-token.guard";

@Module({
  imports: [OrdersModule, ProductsModule],
  controllers: [AdminController],
  providers: [AdminTokenGuard]
})
export class AdminModule {}
