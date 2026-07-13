import { IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateCmsBlockDto {
  @IsString()
  slotKey!: string;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsString()
  href?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsIn(["draft", "published", "archived"])
  status?: CmsBlockStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export type CmsBlockStatus = "draft" | "published" | "archived";
