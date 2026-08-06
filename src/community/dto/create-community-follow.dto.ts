import { IsOptional, IsString } from "class-validator";

export class CreateCommunityFollowDto {
  @IsString()
  @IsOptional()
  followerPhone?: string;

  @IsString()
  @IsOptional()
  followerName?: string;
}