import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCloudPetDiaryNoteDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" && value.trim() ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  title?: string;

  @Transform(({ value }) => (typeof value === "string" && value.trim() ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body: string;
}
