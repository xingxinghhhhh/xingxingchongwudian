import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCloudPetHomepageDto {
  @IsOptional()
  @IsIn(["sunny", "forest", "midnight"])
  theme?: "sunny" | "forest" | "midnight";

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  headline?: string;

  @IsOptional()
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
