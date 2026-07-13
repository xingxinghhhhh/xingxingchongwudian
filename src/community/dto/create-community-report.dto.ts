import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCommunityReportDto {
  @IsString()
  @IsOptional()
  memberPhone?: string;

  @IsString()
  @IsNotEmpty()
  reporterName!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;
}
