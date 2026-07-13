import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateCommunityLikeDto {
  @IsString()
  @IsNotEmpty()
  memberPhone!: string;

  @IsString()
  @IsOptional()
  authorName?: string;
}
