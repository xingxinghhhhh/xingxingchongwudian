import { IsOptional, IsString } from "class-validator";

export class CreateCommunityLikeDto {
  @IsString()
  @IsOptional()
  memberPhone?: string;

  @IsString()
  @IsOptional()
  authorName?: string;
}