-- Existing member sessions must sign in again; new sessions receive an expiry.
ALTER TABLE "MemberSession" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "MemberSession" ADD COLUMN "revokedAt" DATETIME;

CREATE INDEX "MemberSession_expiresAt_idx" ON "MemberSession"("expiresAt");
