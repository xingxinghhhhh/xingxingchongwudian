import { IsIn } from "class-validator";

export class UpdateCommunityCommentStatusDto {
  @IsIn(["hidden"])
  status!: "hidden";
}
