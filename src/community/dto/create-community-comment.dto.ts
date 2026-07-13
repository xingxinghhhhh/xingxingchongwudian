import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCommunityCommentDto {
  @IsString()
  @IsOptional()
  memberPhone?: string;

  @IsString()
  @IsNotEmpty()
  authorName!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
