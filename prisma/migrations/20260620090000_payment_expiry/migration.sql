-- Add payment expiration and idempotent inventory release markers.
ALTER TABLE "Order" ADD COLUMN "closedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "closeReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "inventoryReleasedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "expiredAt" DATETIME;
