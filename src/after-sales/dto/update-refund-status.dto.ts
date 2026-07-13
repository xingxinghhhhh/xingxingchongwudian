import { IsIn, IsOptional, IsString } from "class-validator";

export type RefundRequestStatus = "approved" | "rejected";

export class UpdateRefundStatusDto {
  @IsIn(["approved", "rejected"])
  status: RefundRequestStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
