ALTER TABLE "CommunityPost" ADD COLUMN "authorDeletedAt" DATETIME;

CREATE INDEX "CommunityPost_authorDeletedAt_idx"
ON "CommunityPost"("authorDeletedAt");
