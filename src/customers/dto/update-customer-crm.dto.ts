import { IsArray, IsOptional, IsString } from "class-validator";

export class UpdateCustomerCrmDto {
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  ownerStaffName?: string;
}
