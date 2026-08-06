import { Transform } from "class-transformer";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCommunityCommentDto {
  @IsString()
  @IsOptional()
  memberPhone?: string;

  @IsString()
  @IsOptional()
  authorName?: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  body!: string;
}