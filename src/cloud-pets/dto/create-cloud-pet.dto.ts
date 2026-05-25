import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";

export class CreateCloudPetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  ownerName: string;

  @Matches(/^1[3-9]\d{9}$/)
  ownerPhone: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  name: string;

  @IsIn(["cat", "dog"])
  species: "cat" | "dog";

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  personality: string;
}
