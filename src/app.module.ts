import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminAuthModule } from "./admin-auth/admin-auth.module";
import { AfterSalesModule } from "./after-sales/after-sales.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CartModule } from "./cart/cart.module";
import { CloudPetsModule } from "./cloud-pets/cloud-pets.module";
import { CmsModule } from "./cms/cms.module";
import { CommunityModule } from "./community/community.module";
import { CustomersModule } from "./customers/customers.module";
import { DatabaseModule } from "./database/database.module";
import { LoyaltyModule } from "./loyalty/loyalty.module";
import { MarketingModule } from "./marketing/marketing.module";
import { MembersModule } from "./members/members.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { PersonalizationModule } from "./personalization/personalization.module";
import { ProductsModule } from "./products/products.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { StaffModule } from "./staff/staff.module";
import { getRateLimitTracker } from "./config/rate-limit-tracker";
import { validateEnvironment } from "./config/environment";
import { RequestContextMiddleware } from "./observability/request-context.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      ignoreEnvFile: process.env.NODE_ENV === "test",
      isGlobal: true,
      validate: validateEnvironment
    }),
    ThrottlerModule.forRoot({
      errorMessage: "操作过于频繁，请稍后再试。",
      getTracker: getRateLimitTracker,
      throttlers: [{ limit: 60, ttl: 60_000 }]
    }),
    AdminAuthModule,
    AfterSalesModule,
    AdminModule,
    AnalyticsModule,
    AuthModule,
    CartModule,
    CloudPetsModule,
    CmsModule,
    CommunityModule,
    CustomersModule,
    DatabaseModule,
    LoyaltyModule,
    MarketingModule,
    MembersModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    PersonalizationModule,
    ProductsModule,
    ReviewsModule,
    StaffModule
  ],
  controllers: [AppController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
