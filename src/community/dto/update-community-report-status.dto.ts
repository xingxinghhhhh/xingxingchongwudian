import { IsIn, IsOptional, IsString } from "class-validator";
import type { CommunityReportStatus } from "../community.service";

export class UpdateCommunityReportStatusDto {
  @IsIn(["pending_review", "reviewed", "dismissed"])
  status!: CommunityReportStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
