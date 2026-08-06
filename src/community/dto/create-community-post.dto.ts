import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  petNo: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  authorName?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  body: string;
}