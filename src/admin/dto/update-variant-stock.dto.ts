import { IsInt, Min } from "class-validator";

export class UpdateVariantStockDto {
  @IsInt()
  @Min(0)
  stock!: number;
}
