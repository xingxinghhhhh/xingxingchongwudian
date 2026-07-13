import { IsIn } from "class-validator";

export class UpdateCommunityPostStatusDto {
  @IsIn(["visible", "hidden"])
  status!: "visible" | "hidden";
}
