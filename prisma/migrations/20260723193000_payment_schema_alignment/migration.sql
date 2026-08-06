-- Align the original payment table with Payment Intent and Ledger models.
CREATE TABLE "PaymentLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "paymentIntentId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "providerTradeNo" TEXT,
    "eventType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentLedgerEntry_paymentIntentId_fkey" FOREIGN KEY ("paymentIntentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payUrl" TEXT NOT NULL,
    "providerTxnId" TEXT,
    "providerTradeNo" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "failedAt" DATETIME,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "previousPaymentIntentId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "paidAt" DATETIME,
    "expiresAt" DATETIME,
    "expiredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_Payment" (
    "id",
    "orderId",
    "memberId",
    "provider",
    "status",
    "amountCents",
    "currency",
    "payUrl",
    "providerTxnId",
    "providerTradeNo",
    "cancelledAt",
    "cancelReason",
    "failureCode",
    "failureMessage",
    "failedAt",
    "attemptNo",
    "previousPaymentIntentId",
    "idempotencyKey",
    "paidAt",
    "expiresAt",
    "expiredAt",
    "createdAt",
    "updatedAt"
)
SELECT
    "Payment"."id",
    "Payment"."orderId",
    "Order"."customerPhone",
    "Payment"."provider",
    "Payment"."status",
    "Payment"."amountCents",
    'CNY',
    'mock://legacy/' || "Payment"."id",
    "Payment"."providerTxnId",
    "Payment"."providerTxnId",
    "Payment"."cancelledAt",
    "Payment"."cancelReason",
    "Payment"."failureCode",
    "Payment"."failureMessage",
    "Payment"."failedAt",
    "Payment"."attemptNo",
    "Payment"."previousPaymentIntentId",
    'legacy-payment:' || "Payment"."id",
    CASE WHEN "Payment"."status" = 'paid' THEN "Payment"."updatedAt" ELSE NULL END,
    "Payment"."expiresAt",
    "Payment"."expiredAt",
    "Payment"."createdAt",
    "Payment"."updatedAt"
FROM "Payment"
INNER JOIN "Order" ON "Order"."id" = "Payment"."orderId";

DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");
CREATE INDEX "Payment_memberId_idx" ON "Payment"("memberId");
CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE UNIQUE INDEX "PaymentLedgerEntry_idempotencyKey_key" ON "PaymentLedgerEntry"("idempotencyKey");
CREATE INDEX "PaymentLedgerEntry_orderId_createdAt_idx" ON "PaymentLedgerEntry"("orderId", "createdAt");
CREATE INDEX "PaymentLedgerEntry_paymentIntentId_createdAt_idx" ON "PaymentLedgerEntry"("paymentIntentId", "createdAt");
CREATE INDEX "PaymentLedgerEntry_memberId_createdAt_idx" ON "PaymentLedgerEntry"("memberId", "createdAt");
