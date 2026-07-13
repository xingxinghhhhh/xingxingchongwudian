import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewsService } from "./reviews.service";

@Controller("reviews")
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  listReviews() {
    return this.reviewsService.listAdminReviews();
  }

  @Post()
  createReview(@Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(dto);
  }

  @Get("products/:slug")
  listProductReviews(@Param("slug") slug: string) {
    return this.reviewsService.listVisibleProductReviews(slug);
  }
}

@Controller("products/:slug/reviews")
export class ProductReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  listProductReviews(@Param("slug") slug: string) {
    return this.reviewsService.listVisibleProductReviews(slug);
  }
}
