import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class CreatePaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsIn(["mock_wechat", "mock_alipay"])
  provider: "mock_wechat" | "mock_alipay";
}
