import { IsOptional, IsString, MaxLength } from "class-validator";

export class RecordCloudPetHomepageVisitDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string;
}
