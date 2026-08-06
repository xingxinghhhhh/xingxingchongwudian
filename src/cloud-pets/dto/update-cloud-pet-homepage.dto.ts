import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCloudPetHomepageDto {
  @IsOptional()
  @IsIn(["sunny", "forest", "midnight"])
  theme?: "sunny" | "forest" | "midnight";

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  headline?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  ownerStory?: string;

  @IsOptional()
  @IsBoolean()
  showGrowthArchive?: boolean;

  @IsOptional()
  @IsBoolean()
  showMallRecommendations?: boolean;
}
