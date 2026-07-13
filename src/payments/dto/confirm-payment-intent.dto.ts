import { IsIn, IsOptional } from "class-validator";

export class ConfirmPaymentIntentDto {
  @IsOptional()
  @IsIn(["success", "failed"])
  result?: "success" | "failed";
}
