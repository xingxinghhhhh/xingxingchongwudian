import { IsNotEmpty, IsString } from "class-validator";

export class RedeemMemberPointsDto {
  @IsString()
  @IsNotEmpty()
  rewardKey!: string;
}
