import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class LoginMemberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}
