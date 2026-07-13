import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import type { MemberCancelReason } from "../orders.service";

export class CancelOrderDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([
    "ORDER_CREATED_BY_MISTAKE",
    "CHANGED_MIND",
    "WRONG_PRODUCT",
    "WRONG_ADDRESS",
    "FOUND_BETTER_OPTION",
    "OTHER"
  ])
  reason: MemberCancelReason;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
