import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class CreateCommunityPostDto {
  @IsString()
  @IsNotEmpty()
  petNo: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  authorName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(280)
  body: string;
}
