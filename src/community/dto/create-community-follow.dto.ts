import { IsNotEmpty, IsString } from "class-validator";

export class CreateCommunityFollowDto {
  @IsString()
  @IsNotEmpty()
  followerPhone!: string;

  @IsString()
  @IsNotEmpty()
  followerName!: string;
}
