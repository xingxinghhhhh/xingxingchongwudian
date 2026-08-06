import { Transform } from "class-transformer";
import { IsString, Matches, MaxLength } from "class-validator";

export class LoginMemberDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value
  )
  @IsString()
  @MaxLength(64)
  @Matches(/^verify_[a-zA-Z0-9_-]{16,48}$/)
  challengeId: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value
  )
  @Matches(/^\d{6}$/)
  code: string;
}
