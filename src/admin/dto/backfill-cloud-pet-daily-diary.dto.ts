import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches
} from "class-validator";

export class BackfillCloudPetDailyDiaryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsIn(["missingOnly", "selected"])
  mode!: "missingOnly" | "selected";

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  petIds?: string[];
}
