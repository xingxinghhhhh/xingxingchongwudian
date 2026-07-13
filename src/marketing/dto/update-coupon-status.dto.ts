import { IsIn } from "class-validator";

export type CouponStatus = "active" | "paused" | "archived";

export class UpdateCouponStatusDto {
  @IsIn(["active", "paused", "archived"])
  status: CouponStatus;
}
