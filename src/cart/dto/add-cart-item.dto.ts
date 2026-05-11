import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from "class-validator";

export class AddCartItemDto {
  @IsOptional()
  @IsString()
  cartId?: string;

  @IsString()
  @IsNotEmpty()
  skuCode: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
