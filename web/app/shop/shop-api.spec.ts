import {
  addCartItem,
  cancelOrder,
  checkoutCart,
  confirmPaymentIntent,
  createPaymentIntent,
  createProductReview,
  getOrder,
  getOrderPaymentAttempts,
  getPaymentIntent,
  getProductDetail,
  listProductReviews,
  listProducts,
  searchProducts
} from "./shop-api";

describe("shop api client", () => {
  it("loads products from the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            slug: "durable-bite-rope",
            title: "Durable bite rope",
            priceCents: 3990
          }
        ]
      })
    });

    await expect(listProducts(fetcher)).resolves.toEqual([
      expect.objectContaining({
        slug: "durable-bite-rope",
        priceCents: 3990
      })
    ]);
  });

  it("loads filtered products with discovery metadata", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ slug: "durable-bite-rope", priceCents: 3990 }],
        meta: {
          total: 1,
          filters: { q: "rope", petType: "dog" },
          sort: "price_desc",
          availablePetTypes: ["dog"],
          availableToyTypes: ["chew"],
          priceRange: { minCents: 3990, maxCents: 3990 }
        }
      })
    });

    await expect(
      searchProducts({ q: "rope", petType: "dog", sort: "price_desc" }, fetcher)
    ).resolves.toMatchObject({
      meta: { total: 1, sort: "price_desc" }
    });
  });

  it("adds an item to the cart through the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        cartId: "cart_000001",
        items: [{ skuCode: "DBR-GREEN-M", quantity: 1 }],
        subtotalCents: 3990
      })
    });

    await expect(
      addCartItem({ skuCode: "DBR-GREEN-M", quantity: 1, cartId: "cart_000001" }, fetcher)
    ).resolves.toMatchObject({ cartId: "cart_000001", subtotalCents: 3990 });
  });

  it("loads product detail with variants from the API", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        slug: "durable-bite-rope",
        title: "Durable bite rope",
        variants: [{ skuCode: "DBR-GREEN-M", stock: 50 }]
      })
    });

    await expect(getProductDetail("durable-bite-rope", fetcher)).resolves.toEqual(
      expect.objectContaining({
        slug: "durable-bite-rope",
        variants: [expect.objectContaining({ skuCode: "DBR-GREEN-M" })]
      })
    );
  });

  it("loads and submits product reviews", async () => {
    const listFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: { averageRating: 5, reviewCount: 1 },
        items: [{ reviewNo: "REV001", rating: 5, status: "visible" }]
      })
    });
    const createFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reviewNo: "REV002",
        status: "pending_review",
        rating: 5
      })
    });

    await expect(listProductReviews("durable-bite-rope", listFetcher)).resolves.toMatchObject({
      summary: { averageRating: 5, reviewCount: 1 }
    });

    await expect(
      createProductReview(
        {
          orderNo: "KZT202605270001",
          skuCode: "DBR-GREEN-M",
          rating: 5,
          body: "Very durable"
        },
        createFetcher
      )
    ).resolves.toMatchObject({ status: "pending_review" });
  });

  it("surfaces API error messages", async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Insufficient stock for SKU DBR-GREEN-M" })
    });

    await expect(addCartItem({ skuCode: "DBR-GREEN-M", quantity: 999 }, fetcher)).rejects.toThrow(
      "Insufficient stock for SKU DBR-GREEN-M"
    );
  });

  it("checks out a cart into a pending order and can re-read the order", async () => {
    const checkoutFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderNo: "KZT20260525083000",
        status: "pending_payment",
        totalCents: 3990
      })
    });
    const orderFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderNo: "KZT20260525083000",
        status: "pending_payment",
        totalCents: 3990,
        items: []
      })
    });

    await expect(
      checkoutCart(
        "cart_000001",
        {
          couponCode: "WELCOME20",
          customer: { name: "Demo Customer", phone: "13800138000" },
          address: {
            receiverName: "Demo Customer",
            phone: "13800138000",
            province: "Guangdong",
            city: "Shenzhen",
            district: "Nanshan",
            detail: "Science Park 1"
          }
        },
        checkoutFetcher
      )
    ).resolves.toMatchObject({ status: "pending_payment" });

    await expect(getOrder("KZT20260525083000", orderFetcher)).resolves.toMatchObject({
      orderNo: "KZT20260525083000"
    });
  });

  it("creates, loads, and confirms a payment intent", async () => {
    const createFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "PAY202605250830000001",
        orderId: "KZT20260525083000",
        memberId: "13800138000",
        amount: 3990,
        currency: "CNY",
        provider: "mock_wechat",
        status: "pending",
        idempotencyKey: "payment_intent:PAY202605250830000001",
        payUrl: "/mock-pay/wechat/KZT20260525083000",
        createdAt: "2026-05-25T08:30:00.000Z",
        updatedAt: "2026-05-25T08:30:00.000Z",
        orderStatus: "pending_payment"
      })
    });
    const getFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "PAY202605250830000001",
        orderId: "KZT20260525083000",
        memberId: "13800138000",
        amount: 3990,
        currency: "CNY",
        provider: "mock_wechat",
        status: "pending",
        idempotencyKey: "payment_intent:PAY202605250830000001",
        payUrl: "/mock-pay/wechat/KZT20260525083000",
        createdAt: "2026-05-25T08:30:00.000Z",
        updatedAt: "2026-05-25T08:30:00.000Z",
        orderStatus: "pending_payment"
      })
    });
    const confirmFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderStatus: "paid",
        paymentIntent: {
          id: "PAY202605250830000001",
          orderId: "KZT20260525083000",
          memberId: "13800138000",
          amount: 3990,
          currency: "CNY",
          provider: "mock_wechat",
          status: "paid",
          providerTradeNo: "wx_pay202605250830000001",
          idempotencyKey: "payment_intent:PAY202605250830000001",
          payUrl: "/mock-pay/wechat/KZT20260525083000",
          createdAt: "2026-05-25T08:30:00.000Z",
          updatedAt: "2026-05-25T08:31:00.000Z",
          paidAt: "2026-05-25T08:31:00.000Z",
          orderStatus: "paid"
        }
      })
    });

    await expect(
      createPaymentIntent(
        {
          orderId: "KZT20260525083000",
          provider: "mock_wechat",
          sessionToken: "member_202605250001"
        },
        createFetcher
      )
    ).resolves.toMatchObject({ id: "PAY202605250830000001", status: "pending" });
    expect(createFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/payments/intents",
      {
        body: JSON.stringify({
          orderId: "KZT20260525083000",
          provider: "mock_wechat"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202605250001"
        },
        method: "POST"
      }
    );

    await expect(
      getPaymentIntent("PAY202605250830000001", "member_202605250001", getFetcher)
    ).resolves.toMatchObject({ id: "PAY202605250830000001" });

    await expect(
      confirmPaymentIntent(
        {
          paymentIntentId: "PAY202605250830000001",
          result: "success",
          sessionToken: "member_202605250001"
        },
        confirmFetcher
      )
    ).resolves.toMatchObject({ orderStatus: "paid" });
  });
  it("loads payment attempts and cancels an unpaid order with member auth", async () => {
    const attemptsFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: "KZT20260525083000",
        attempts: [
          {
            attemptNo: 1,
            paymentIntentId: "PAY202605250830000001",
            provider: "mock_wechat",
            status: "failed",
            failureCode: "PAYMENT_DECLINED"
          }
        ]
      })
    });
    const cancelFetcher = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        orderId: "KZT20260525083000",
        orderStatus: "cancelled",
        closeReason: "MEMBER_CANCELLED",
        memberCancelReason: "CHANGED_MIND",
        inventoryReleased: true,
        paymentIntent: {
          id: "PAY202605250830000001",
          status: "cancelled"
        }
      })
    });

    await expect(
      getOrderPaymentAttempts(
        "KZT20260525083000",
        "member_202605250001",
        attemptsFetcher
      )
    ).resolves.toMatchObject({
      attempts: [
        {
          attemptNo: 1,
          status: "failed"
        }
      ]
    });
    expect(attemptsFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/orders/KZT20260525083000/payment-attempts",
      {
        cache: "no-store",
        headers: {
          "X-Member-Token": "member_202605250001"
        }
      }
    );

    await expect(
      cancelOrder(
        {
          orderId: "KZT20260525083000",
          reason: "CHANGED_MIND",
          note: "Placed twice",
          sessionToken: "member_202605250001"
        },
        cancelFetcher
      )
    ).resolves.toMatchObject({
      inventoryReleased: true,
      orderStatus: "cancelled",
      paymentIntent: {
        status: "cancelled"
      }
    });
    expect(cancelFetcher).toHaveBeenCalledWith(
      "http://localhost:3000/api/orders/KZT20260525083000/cancel",
      {
        body: JSON.stringify({
          note: "Placed twice",
          reason: "CHANGED_MIND"
        }),
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Member-Token": "member_202605250001"
        },
        method: "POST"
      }
    );
  });
});




