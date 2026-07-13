import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { CommunityModule } from "../community/community.module";
import { CustomersModule } from "../customers/customers.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { MarketingModule } from "../marketing/marketing.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { OrdersModule } from "../orders/orders.module";
import { PersonalizationModule } from "../personalization/personalization.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { CmsModule } from "../cms/cms.module";
import { MembersController } from "./members.controller";
import { MembersService } from "./members.service";

@Module({
  imports: [
    AuthModule,
    CloudPetsModule,
    CommunityModule,
    CustomersModule,
    LoyaltyModule,
    MarketingModule,
    NotificationsModule,
    OrdersModule,
    PersonalizationModule,
    CmsModule,
    ReviewsModule
  ],
  controllers: [MembersController],
  providers: [MembersService]
})
export class MembersModule {}
