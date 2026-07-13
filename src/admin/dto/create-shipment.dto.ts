import { IsNotEmpty, IsString } from "class-validator";

export class CreateShipmentDto {
  @IsString()
  @IsNotEmpty()
  carrier!: string;

  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;
}
