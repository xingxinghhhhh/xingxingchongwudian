CREATE TABLE "MemberAuthChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "MemberAuthChallenge_phone_createdAt_idx"
ON "MemberAuthChallenge"("phone", "createdAt");

CREATE INDEX "MemberAuthChallenge_expiresAt_idx"
ON "MemberAuthChallenge"("expiresAt");
