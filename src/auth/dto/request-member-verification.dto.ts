import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class RequestMemberVerificationDto {
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() ? value.trim() : value
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  name: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() : value
  )
  @Matches(/^1[3-9]\d{9}$/)
  phone: string;
}
