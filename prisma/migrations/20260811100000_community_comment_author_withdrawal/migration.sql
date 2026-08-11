ALTER TABLE "CommunityComment" ADD COLUMN "authorDeletedAt" DATETIME;

CREATE INDEX "CommunityComment_authorDeletedAt_idx"
ON "CommunityComment"("authorDeletedAt");
