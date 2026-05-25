import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OrdersModule } from "../orders/orders.module";
import { ProductsModule } from "../products/products.module";
import { CartController } from "./cart.controller";
import { CartService } from "./cart.service";

@Module({
  imports: [DatabaseModule, OrdersModule, ProductsModule],
  controllers: [CartController],
  providers: [CartService]
})
export class CartModule {}
