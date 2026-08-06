import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommunityReportDto {
  @IsString()
  @IsOptional()
  memberPhone?: string;

  @IsString()
  @IsOptional()
  reporterName?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  reason!: string;
}