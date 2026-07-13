import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

class CreateOrderCustomerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}

class CreateOrderAddressDto {
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

class CreateOrderItemDto {
  @IsString()
  @IsNotEmpty()
  skuCode: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  couponCodes?: string[];

  @ValidateNested()
  @Type(() => CreateOrderCustomerDto)
  customer: CreateOrderCustomerDto;

  @ValidateNested()
  @Type(() => CreateOrderAddressDto)
  address: CreateOrderAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
