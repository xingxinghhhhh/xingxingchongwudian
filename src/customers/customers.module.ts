import { Module } from "@nestjs/common";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { CommunityModule } from "../community/community.module";
import { OrdersModule } from "../orders/orders.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { CustomersService } from "./customers.service";

@Module({
  imports: [CloudPetsModule, CommunityModule, OrdersModule, ReviewsModule],
  providers: [CustomersService],
  exports: [CustomersService]
})
export class CustomersModule {}
