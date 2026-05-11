import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  orderNo: string;

  @IsIn(["h5", "jsapi", "native"])
  channel: "h5" | "jsapi" | "native";
}
