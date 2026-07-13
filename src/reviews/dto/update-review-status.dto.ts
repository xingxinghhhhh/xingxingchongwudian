import { IsIn } from "class-validator";
import type { ProductReviewStatus } from "../reviews.service";

export class UpdateReviewStatusDto {
  @IsIn(["pending_review", "visible", "hidden"])
  status!: ProductReviewStatus;
}
