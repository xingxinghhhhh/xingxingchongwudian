import { IsIn } from "class-validator";
import { CmsBlockStatus } from "./create-cms-block.dto";

export class UpdateCmsBlockStatusDto {
  @IsIn(["draft", "published", "archived"])
  status!: CmsBlockStatus;
}
