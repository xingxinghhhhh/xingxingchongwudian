import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { ProductsService } from "../products/products.service";
import { CreateReviewDto } from "./dto/create-review.dto";

export type ProductReviewStatus = "pending_review" | "visible" | "hidden";

export interface ProductReviewRecord {
  reviewNo: string;
  orderNo: string;
  productSlug: string;
  skuCode: string;
  rating: number;
  body: string;
  images: string[];
  authorName: string;
  status: ProductReviewStatus;
  createdAt: string;
}

@Injectable()
export class ReviewsService {
  private readonly reviews: ProductReviewRecord[] = [];
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly productsService: ProductsService
  ) {}

  async createReview(dto: CreateReviewDto): Promise<ProductReviewRecord> {
    const order = await this.ordersService.getOrder(dto.orderNo);

    if (order.status !== "completed") {
      throw new BadRequestException("Only completed orders can be reviewed");
    }

    const orderItem = order.items.find((item) => item.skuCode === dto.skuCode);

    if (!orderItem) {
      throw new BadRequestException("SKU is not part of this order");
    }

    const match = await this.productsService.findVariantBySkuCode(dto.skuCode);

    if (!match) {
      throw new NotFoundException("Product variant not found");
    }

    if (!this.isDatabaseConfigured()) {
      if (
        this.reviews.some(
          (review) =>
            review.orderNo === dto.orderNo && review.skuCode === dto.skuCode
        )
      ) {
        throw new ConflictException("Review already exists for this order item");
      }

      const review = {
        reviewNo: this.createReviewNo(),
        orderNo: dto.orderNo,
        productSlug: match.product.slug,
        skuCode: dto.skuCode,
        rating: dto.rating,
        body: dto.body,
        images: dto.images ?? [],
        authorName: dto.authorName ?? order.customer.name,
        status: "pending_review",
        createdAt: new Date().toISOString()
      } satisfies ProductReviewRecord;
      this.reviews.unshift(review);
      return review;
    }

    const [dbOrder, dbProduct] = await Promise.all([
      this.prisma.order.findUniqueOrThrow({
        where: { orderNo: dto.orderNo },
        select: { id: true }
      }),
      this.prisma.product.findUniqueOrThrow({
        where: { slug: match.product.slug },
        select: { id: true }
      })
    ]);

    try {
      const review = await this.prisma.productReview.create({
        data: {
          reviewNo: this.createReviewNo(),
          orderId: dbOrder.id,
          orderNo: dto.orderNo,
          productId: dbProduct.id,
          productSlug: match.product.slug,
          skuCode: dto.skuCode,
          rating: dto.rating,
          body: dto.body,
          images: dto.images ?? [],
          authorName: dto.authorName ?? order.customer.name
        }
      });

      return this.toRecord(review);
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Review already exists for this order item");
      }

      throw error;
    }
  }

  async listAdminReviews(): Promise<ProductReviewRecord[]> {
    if (!this.isDatabaseConfigured()) {
      return this.reviews;
    }

    const reviews = await this.prisma.productReview.findMany({
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return reviews.map((review) => this.toRecord(review));
  }

  async listReviewsByCustomerPhone(phone: string): Promise<ProductReviewRecord[]> {
    const orders = await this.ordersService.listOrdersByCustomerPhone(phone);
    const orderNos = new Set(orders.map((order) => order.orderNo));
    const reviews = await this.listAdminReviews();

    return reviews.filter((review) => orderNos.has(review.orderNo));
  }

  async listVisibleProductReviews(productSlug: string) {
    const reviews = this.isDatabaseConfigured()
      ? (
          await this.prisma.productReview.findMany({
            where: { productSlug, status: "visible" },
            orderBy: { createdAt: "desc" },
            take: 50
          })
        ).map((review) => this.toRecord(review))
      : this.reviews.filter(
          (review) =>
            review.productSlug === productSlug && review.status === "visible"
        );

    const reviewCount = reviews.length;
    const averageRating =
      reviewCount === 0
        ? 0
        : Number(
            (
              reviews.reduce((total, review) => total + review.rating, 0) /
              reviewCount
            ).toFixed(1)
          );

    return {
      summary: {
        averageRating,
        reviewCount
      },
      items: reviews
    };
  }

  async updateReviewStatus(
    reviewNo: string,
    status: ProductReviewStatus
  ): Promise<ProductReviewRecord> {
    if (!this.isDatabaseConfigured()) {
      const review = this.reviews.find((item) => item.reviewNo === reviewNo);

      if (!review) {
        throw new NotFoundException("Review not found");
      }

      review.status = status;
      return review;
    }

    const review = await this.prisma.productReview.update({
      where: { reviewNo },
      data: { status }
    });

    return this.toRecord(review);
  }

  private toRecord(review: {
    reviewNo: string;
    orderNo: string;
    productSlug: string;
    skuCode: string;
    rating: number;
    body: string;
    images: unknown;
    authorName: string;
    status: ProductReviewStatus;
    createdAt: Date | string;
  }): ProductReviewRecord {
    return {
      reviewNo: review.reviewNo,
      orderNo: review.orderNo,
      productSlug: review.productSlug,
      skuCode: review.skuCode,
      rating: review.rating,
      body: review.body,
      images: Array.isArray(review.images)
        ? review.images.filter((item): item is string => typeof item === "string")
        : [],
      authorName: review.authorName,
      status: review.status,
      createdAt:
        review.createdAt instanceof Date
          ? review.createdAt.toISOString()
          : review.createdAt
    };
  }

  private createReviewNo() {
    this.sequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `REV${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    );
  }
}
