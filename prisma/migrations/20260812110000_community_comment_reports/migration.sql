ALTER TABLE "CommunityReport" ADD COLUMN "commentNo" TEXT;

CREATE INDEX "CommunityReport_commentNo_idx"
ON "CommunityReport"("commentNo");
