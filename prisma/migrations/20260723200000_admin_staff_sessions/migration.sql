-- Persist production staff accounts and revocable admin sessions.
CREATE TABLE "AdminStaffAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AdminStaffSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminStaffSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdminStaffAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AdminStaffAccount_staffNo_key" ON "AdminStaffAccount"("staffNo");
CREATE UNIQUE INDEX "AdminStaffAccount_email_key" ON "AdminStaffAccount"("email");
CREATE INDEX "AdminStaffAccount_role_status_idx" ON "AdminStaffAccount"("role", "status");
CREATE UNIQUE INDEX "AdminStaffSession_token_key" ON "AdminStaffSession"("token");
CREATE INDEX "AdminStaffSession_staffId_revokedAt_idx" ON "AdminStaffSession"("staffId", "revokedAt");
CREATE INDEX "AdminStaffSession_expiresAt_idx" ON "AdminStaffSession"("expiresAt");
