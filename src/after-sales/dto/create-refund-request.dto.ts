import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateRefundRequestDto {
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsInt()
  @Min(1)
  requestedAmountCents: number;
}
