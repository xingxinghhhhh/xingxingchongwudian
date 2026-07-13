import { Type } from "class-transformer";
import { IsArray, IsNotEmpty, IsOptional, IsString, Matches, ValidateNested } from "class-validator";

class CheckoutCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}

class CheckoutAddressDto {
  @IsString()
  @IsNotEmpty()
  receiverName: string;

  @Matches(/^1[3-9]\d{9}$/)
  phone: string;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  district: string;

  @IsString()
  @IsNotEmpty()
  detail: string;
}

export class CheckoutCartDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  couponCodes?: string[];

  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer: CheckoutCustomerDto;

  @ValidateNested()
  @Type(() => CheckoutAddressDto)
  address: CheckoutAddressDto;
}
