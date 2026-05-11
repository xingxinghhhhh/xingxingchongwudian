import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class PaymentNotifyDto {
  @IsString()
  @IsNotEmpty()
  paymentNo: string;

  @IsString()
  @IsNotEmpty()
  providerTradeNo: string;

  @IsInt()
  @Min(1)
  paidAmountCents: number;
}
