ALTER TABLE "CommunityComment" ADD COLUMN "parentCommentNo" TEXT;

CREATE INDEX "CommunityComment_parentCommentNo_idx"
ON "CommunityComment"("parentCommentNo");
