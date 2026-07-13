import { IsIn } from "class-validator";

export class UpdateProductStatusDto {
  @IsIn(["active", "draft", "archived"])
  status!: "active" | "draft" | "archived";
}
