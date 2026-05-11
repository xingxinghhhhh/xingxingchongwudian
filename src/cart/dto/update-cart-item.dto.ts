import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class UpdateCartItemDto {
  @IsString()
  @IsNotEmpty()
  cartId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}
