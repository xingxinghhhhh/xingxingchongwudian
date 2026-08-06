import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateCloudPetDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ownerName: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^1[3-9]\d{9}$/)
  ownerPhone: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  name: string;

  @IsIn(["cat", "dog"])
  species: "cat" | "dog";

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  personality: string;
}
