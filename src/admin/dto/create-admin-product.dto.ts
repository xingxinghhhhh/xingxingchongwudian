import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested
} from "class-validator";

class CreateAdminProductVariantDto {
  @IsString()
  @IsNotEmpty()
  skuCode: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  material?: string;

  @IsInt()
  @Min(1)
  priceCents: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  compareAtCents?: number;

  @IsInt()
  @Min(0)
  stock: number;
}

export class CreateAdminProductDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsIn(["cat", "dog", "both"])
  petType: "cat" | "dog" | "both";

  @IsString()
  @IsNotEmpty()
  toyType: string;

  @IsOptional()
  @IsIn(["active", "draft", "archived"])
  status?: "active" | "draft" | "archived";

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  images: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAdminProductVariantDto)
  variants: CreateAdminProductVariantDto[];
}
