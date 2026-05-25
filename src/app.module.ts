import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { CartModule } from "./cart/cart.module";
import { CloudPetsModule } from "./cloud-pets/cloud-pets.module";
import { CommunityModule } from "./community/community.module";
import { DatabaseModule } from "./database/database.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProductsModule } from "./products/products.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AdminModule,
    CartModule,
    CloudPetsModule,
    CommunityModule,
    DatabaseModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule
  ],
  controllers: [AppController]
})
export class AppModule {}
