-- Add member-driven unpaid order cancellation fields.
ALTER TABLE "Order" ADD COLUMN "memberCancelReason" TEXT;
ALTER TABLE "Order" ADD COLUMN "memberCancelNote" TEXT;
ALTER TABLE "Payment" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "cancelReason" TEXT;
