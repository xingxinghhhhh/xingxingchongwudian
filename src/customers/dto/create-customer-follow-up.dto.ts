import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";

export class CreateCustomerFollowUpDto {
  @IsIn(["call", "wechat", "note"])
  type!: "call" | "wechat" | "note";

  @IsString()
  summary!: string;

  @IsISO8601()
  @IsOptional()
  nextActionAt?: string;
}
