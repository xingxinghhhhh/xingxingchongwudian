import { IsBoolean, IsOptional, IsString } from "class-validator";

export class CreateCustomerAddressDto {
  @IsString()
  receiverName!: string;

  @IsString()
  phone!: string;

  @IsString()
  province!: string;

  @IsString()
  city!: string;

  @IsString()
  district!: string;

  @IsString()
  detail!: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
