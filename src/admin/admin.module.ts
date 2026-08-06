import { Module } from "@nestjs/common";
import { AdminAuthModule } from "../admin-auth/admin-auth.module";
import { AfterSalesModule } from "../after-sales/after-sales.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { AuthModule } from "../auth/auth.module";
import { CloudPetsModule } from "../cloud-pets/cloud-pets.module";
import { CmsModule } from "../cms/cms.module";
import { CommunityModule } from "../community/community.module";
import { CustomersModule } from "../customers/customers.module";
import { MarketingModule } from "../marketing/marketing.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { ProductsModule } from "../products/products.module";
import { ReviewsModule } from "../reviews/reviews.module";
import { StaffModule } from "../staff/staff.module";
import { AdminController } from "./admin.controller";
import { AdminTokenGuard } from "./admin-token.guard";

@Module({
  imports: [
    AdminAuthModule,
    AuthModule,
    CloudPetsModule,
    CommunityModule,
    AfterSalesModule,
    AnalyticsModule,
    CmsModule,
    MarketingModule,
    CustomersModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule,
    ReviewsModule,
    StaffModule
  ],
  controllers: [AdminController],
  providers: [AdminTokenGuard]
})
export class AdminModule {}


