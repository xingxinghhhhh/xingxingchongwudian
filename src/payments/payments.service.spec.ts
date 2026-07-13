import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { PaymentsService } from "./payments.service";

function createConfigService(databaseUrl?: string, timeoutMinutes?: string): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === "DATABASE_URL") {
        return databaseUrl;
      }

      if (key === "PAYMENT_TIMEOUT_MINUTES") {
        return timeoutMinutes;
      }

      return undefined;
    })
  } as unknown as ConfigService;
}

describe("PaymentsService", () => {
  function createService(orderOverrides?: Partial<any>, timeoutMinutes?: string) {
    const order: any = {
      orderNo: "KZT202606190001",
      customer: {
        name: "Member A",
        phone: "13800138000"
      },
      items: [],
      status: "pending_payment",
      totalCents: 3990,
      ...orderOverrides
    };
    const ordersService = {
      getOrder: jest.fn(async (orderId: string) => {
        if (orderId !== order.orderNo) {
          throw new NotFoundException("Order not found");
        }

        return order;
      }),
      markOrderPaid: jest.fn(async () => {
        order.status = "paid";
        return order;
      }),
      closeOrderForPaymentTimeout: jest.fn(async () => {
        if (order.status === "pending_payment") {
          order.status = "cancelled";
          order.closeReason = "PAYMENT_TIMEOUT";
          order.inventoryReleasedAt = new Date().toISOString();
        }
        return order;
      }),
      closeUnpaidOrder: jest.fn(
        async (
          orderId: string,
          input: {
            closeReason: "PAYMENT_TIMEOUT" | "MEMBER_CANCELLED";
            memberCancelReason?: string;
            memberCancelNote?: string;
          }
        ) => {
          if (orderId !== order.orderNo) {
            throw new NotFoundException("Order not found");
          }

          const inventoryReleased = !order.inventoryReleasedAt;

          if (order.status === "pending_payment") {
            order.status = "cancelled";
            order.closeReason = input.closeReason;
            order.closedAt = new Date().toISOString();
            order.inventoryReleasedAt ??= order.closedAt;

            if (input.closeReason === "MEMBER_CANCELLED") {
              order.memberCancelReason = input.memberCancelReason;
              order.memberCancelNote = input.memberCancelNote;
            }
          }

          return {
            inventoryReleased,
            order
          };
        }
      )
    };

    return {
      order,
      ordersService,
      service: new PaymentsService(
        ordersService as never,
        createConfigService(undefined, timeoutMinutes),
        {} as never
      )
    };
  }

  it("creates a payment intent with amount from the order and a mock adapter URL", async () => {
    const { service } = createService();

    const intent = await service.createPaymentIntent("13800138000", {
      orderId: "KZT202606190001",
      provider: "mock_wechat"
    });

    expect(intent).toMatchObject({
      orderId: "KZT202606190001",
      memberId: "13800138000",
      amount: 3990,
      provider: "mock_wechat",
      status: "pending"
    });
    expect(intent.expiresAt).toBeDefined();
    expect(intent.payUrl).toBe("/mock-pay/wechat/KZT202606190001");
  });

  it("adds a server generated expiration deadline to payment intents", async () => {
    const { service } = createService(undefined, "5");

    const intent = await service.createPaymentIntent("13800138000", {
      orderId: "KZT202606190001",
      provider: "mock_wechat"
    });

    expect(new Date(intent.expiresAt!).getTime()).toBeGreaterThan(
      new Date(intent.createdAt).getTime()
    );
  });

  it("rejects payment creation for a different member", async () => {
    const { service } = createService();

    await expect(
      service.createPaymentIntent("13900139000", {
        orderId: "KZT202606190001",
        provider: "mock_wechat"
      })
    ).rejects.toThrow("You can only pay for your own order");
  });

  it("rejects payment creation when the order is already paid", async () => {
    const { service } = createService({ status: "paid" });

    await expect(
      service.createPaymentIntent("13800138000", {
        orderId: "KZT202606190001",
        provider: "mock_wechat"
      })
    ).rejects.toThrow("Order has already been paid");
  });

  it("confirms a payment once, updates the order once, and writes a single success ledger entry", async () => {
    const { order, ordersService, service } = createService();
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });

    const first = await service.confirmPaymentIntent("13800138000", intent.id, {
      result: "success"
    });
    const second = await service.confirmPaymentIntent("13800138000", intent.id, {
      result: "success"
    });
    const detail = await service.getAdminPayment(intent.id);

    expect(first.paymentIntent.status).toBe("paid");
    expect(second.paymentIntent.status).toBe("paid");
    expect(first.orderStatus).toBe("paid");
    expect(ordersService.markOrderPaid).toHaveBeenCalledTimes(1);
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_confirmed")).toHaveLength(1);
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_created")).toHaveLength(1);
  });

  it("marks a payment failed without changing the order to paid", async () => {
    const { order, ordersService, service } = createService();
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_alipay"
    });

    const result = await service.confirmPaymentIntent("13800138000", intent.id, {
      result: "failed"
    });
    const detail = await service.getAdminPayment(intent.id);

    expect(result.paymentIntent.status).toBe("failed");
    expect(result.orderStatus).toBe("pending_payment");
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_failed")).toHaveLength(1);
  });

  it("cancels an unpaid order, marks the payment intent cancelled, and writes one cancel ledger entry", async () => {
    const { order, ordersService, service } = createService();
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });

    const result = await service.cancelOrderByMember("13800138000", order.orderNo, {
      reason: "CHANGED_MIND",
      note: "Need to update the order"
    });
    const detail = await service.getAdminPayment(intent.id);

    expect(result).toMatchObject({
      orderId: order.orderNo,
      orderStatus: "cancelled",
      closeReason: "MEMBER_CANCELLED",
      memberCancelReason: "CHANGED_MIND",
      memberCancelNote: "Need to update the order",
      inventoryReleased: true,
      paymentIntent: {
        id: intent.id,
        status: "cancelled"
      }
    });
    expect(ordersService.closeUnpaidOrder).toHaveBeenCalledTimes(1);
    expect(detail.paymentIntent.status).toBe("cancelled");
    expect(detail.paymentIntent.orderStatus).toBe("cancelled");
    expect(detail.paymentIntent.orderCloseReason).toBe("MEMBER_CANCELLED");
    expect(detail.paymentIntent.orderMemberCancelReason).toBe("CHANGED_MIND");
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_cancelled")).toHaveLength(1);
  });

  it("keeps member cancellation idempotent and does not write duplicate cancel ledger entries", async () => {
    const { order, ordersService, service } = createService();
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });

    const first = await service.cancelOrderByMember("13800138000", order.orderNo, {
      reason: "WRONG_ADDRESS"
    });
    const second = await service.cancelOrderByMember("13800138000", order.orderNo, {
      reason: "WRONG_ADDRESS"
    });
    const detail = await service.getAdminPayment(intent.id);

    expect(first.inventoryReleased).toBe(true);
    expect(second.inventoryReleased).toBe(true);
    expect(second.orderStatus).toBe("cancelled");
    expect(ordersService.closeUnpaidOrder).toHaveBeenCalledTimes(1);
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_cancelled")).toHaveLength(1);
  });

  it("rejects payment confirmation after member cancellation", async () => {
    const { order, ordersService, service } = createService();
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_alipay"
    });

    await service.cancelOrderByMember("13800138000", order.orderNo, {
      reason: "OTHER",
      note: "Cancel before payment"
    });

    await expect(
      service.confirmPaymentIntent("13800138000", intent.id, { result: "success" })
    ).rejects.toThrow("Payment intent has been cancelled");
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();
  });

  it("expires overdue intents, closes the order once, and writes one expired ledger", async () => {
    const { order, ordersService, service } = createService(undefined, "0.001");
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });
    const now = new Date(new Date(intent.expiresAt!).getTime() + 1000);

    const first = await service.expirePaymentIntent(intent.id, now);
    const second = await service.expirePaymentIntent(intent.id, now);
    const detail = await service.getAdminPayment(intent.id);

    expect(first).toMatchObject({
      closedOrder: true,
      inventoryReleased: true,
      status: "expired"
    });
    expect(second).toMatchObject({ status: "skipped" });
    expect(ordersService.closeOrderForPaymentTimeout).toHaveBeenCalledTimes(1);
    expect(detail.paymentIntent.status).toBe("expired");
    expect(detail.paymentIntent.orderStatus).toBe("cancelled");
    expect(detail.paymentIntent.orderCloseReason).toBe("PAYMENT_TIMEOUT");
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_expired")).toHaveLength(1);
  });

  it("rejects confirmation after an intent expires", async () => {
    const { order, service } = createService(undefined, "0.001");
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });

    await new Promise((resolve) => setTimeout(resolve, 80));

    await expect(
      service.confirmPaymentIntent("13800138000", intent.id, { result: "success" })
    ).rejects.toThrow("Payment intent has expired");

    const detail = await service.getAdminPayment(intent.id);
    expect(detail.paymentIntent.status).toBe("expired");
  });

  it("scans only overdue active payment intents", async () => {
    const { order, service } = createService(undefined, "0.001");
    const intent = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_alipay"
    });
    const result = await service.scanExpiredPayments({
      now: new Date(new Date(intent.expiresAt!).getTime() + 1000)
    });

    expect(result).toMatchObject({
      closedOrderCount: 1,
      expiredIntentCount: 1,
      failedCount: 0,
      inventoryReleasedCount: 1,
      scannedCount: 1,
      skippedCount: 0
    });
  });

  it("reuses an active payment intent for the same order", async () => {
    const { order, service } = createService();

    const first = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });
    const second = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });

    expect(second.id).toBe(first.id);
  });

  it("creates a new retry attempt after failure and keeps failure confirmation idempotent", async () => {
    const { order, ordersService, service } = createService();

    const first = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_alipay"
    });

    const failed = await service.confirmPaymentIntent("13800138000", first.id, {
      result: "failed"
    });

    expect(failed.paymentIntent.status).toBe("failed");
    expect(failed.paymentIntent.failureCode).toBe("INSUFFICIENT_BALANCE");
    expect(failed.paymentIntent.attemptNo).toBe(1);
    expect(ordersService.markOrderPaid).not.toHaveBeenCalled();

    await expect(
      service.confirmPaymentIntent("13800138000", first.id, { result: "success" })
    ).rejects.toThrow("Payment intent has failed. Create a new payment attempt.");

    const retry = await service.createPaymentIntent("13800138000", {
      orderId: order.orderNo,
      provider: "mock_wechat"
    });
    expect(retry.id).not.toBe(first.id);
    expect(retry.attemptNo).toBe(2);
    expect(retry.previousPaymentIntentId).toBe(first.id);

    const paid = await service.confirmPaymentIntent("13800138000", retry.id, {
      result: "success"
    });
    const detail = await service.getAdminPayment(retry.id);
    const attempts = await service.listOrderPaymentAttemptsByMember("13800138000", order.orderNo);

    expect(paid.paymentIntent.status).toBe("paid");
    expect(paid.orderStatus).toBe("paid");
    expect(ordersService.markOrderPaid).toHaveBeenCalledTimes(1);
    expect(attempts.attempts).toEqual([
      expect.objectContaining({ paymentIntentId: first.id, attemptNo: 1, status: "failed" }),
      expect.objectContaining({ paymentIntentId: retry.id, attemptNo: 2, status: "paid" })
    ]);
    expect(detail.relatedIntents).toEqual([
      expect.objectContaining({ id: first.id, attemptNo: 1, status: "failed" }),
      expect.objectContaining({ id: retry.id, attemptNo: 2, status: "paid" })
    ]);
    expect(detail.ledger.filter((entry) => entry.eventType === "payment_confirmed")).toHaveLength(1);
  });

});
