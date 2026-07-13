ALTER TABLE "Payment" ADD COLUMN "failureCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "failureMessage" TEXT;
ALTER TABLE "Payment" ADD COLUMN "failedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "attemptNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Payment" ADD COLUMN "previousPaymentIntentId" TEXT;
