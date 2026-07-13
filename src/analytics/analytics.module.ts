import { Module } from "@nestjs/common";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { CommunityModule } from "../community/community.module";
import { OrdersModule } from "../orders/orders.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [CloudPetsModule, CommunityModule, OrdersModule, ReviewsModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}
