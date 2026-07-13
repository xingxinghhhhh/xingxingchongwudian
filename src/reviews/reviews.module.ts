import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { OrdersModule } from "../orders/orders.module";
import { ProductsModule } from "../products/products.module";
import {
  ProductReviewsController,
  ReviewsController
} from "./reviews.controller";
import { ReviewsService } from "./reviews.service";

@Module({
  imports: [DatabaseModule, OrdersModule, ProductsModule],
  controllers: [ReviewsController, ProductReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService]
})
export class ReviewsModule {}
