import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AuthService } from "../src/auth/auth.service";

describe("Pet toy shop API", () => {
  let app: INestApplication;

  async function loginAsAdmin(role: "owner" | "operator") {
    const credentials = {
      owner: {
        email: "owner@example.com",
        password: "owner123456"
      },
      operator: {
        email: "operator@example.com",
        password: "operator123456"
      }
    }[role];

    const response = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send(credentials)
      .expect(201);

    return response.body.sessionToken as string;
  }

  async function loginAsMember(phone: string, name = "Member Session") {
    const authService = app.get(AuthService);
    const challenge = await authService.requestVerification({ name, phone });
    const login = await authService.login({
      challengeId: challenge.challengeId,
      code: challenge.developmentCode!
    });

    return login.sessionToken;
  }

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = "";
    delete process.env.ADMIN_API_KEY;
    const { AppModule } = await import("../src/app.module");

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns service health", async () => {
    await request(app.getHttpServer())
      .get("/api/health")
      .set("X-Request-Id", "health-check-20260723")
      .expect(200)
      .expect("X-Request-Id", "health-check-20260723")
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "ok",
          service: "pet-toy-shop-api",
          database: {
            orm: "prisma",
            provider: "sqlite",
            mode: "memory",
            configured: false
          }
        });
      });

    await request(app.getHttpServer())
      .get("/api/health")
      .set("X-Request-Id", "unsafe request id")
      .expect(200)
      .expect(({ headers }) => {
        expect(headers["x-request-id"]).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
      });

    await request(app.getHttpServer())
      .get("/api/health/live")
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("ok");
      });

    await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "ready",
          database: {
            provider: "sqlite",
            mode: "memory",
            configured: false,
            connected: null
          }
        });
      });
  });

  it("lists starter product catalog items", async () => {
    await request(app.getHttpServer())
      .get("/api/products")
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.items)).toBe(true);
        expect(body.items[0]).toMatchObject({
          slug: "durable-bite-rope",
          petType: "dog",
          status: "active"
        });
      });
  });

  it("filters and sorts public product catalog items", async () => {
    await request(app.getHttpServer())
      .get(
        "/api/products?q=rope&petType=dog&toyType=chew&minPriceCents=3000&maxPriceCents=4500&sort=price_desc"
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta).toMatchObject({
          total: 1,
          filters: {
            q: "rope",
            petType: "dog",
            toyType: "chew",
            minPriceCents: 3000,
            maxPriceCents: 4500
          },
          sort: "price_desc"
        });
        expect(body.meta.availablePetTypes).toEqual(
          expect.arrayContaining(["cat", "dog"])
        );
        expect(body.meta.availableToyTypes).toEqual(
          expect.arrayContaining(["chew", "interactive"])
        );
        expect(body.items).toEqual([
          expect.objectContaining({
            slug: "durable-bite-rope",
            petType: "dog",
            toyType: "chew"
          })
        ]);
      });

    await request(app.getHttpServer())
      .get("/api/products?petType=cat&sort=price_asc")
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta.total).toBe(1);
        expect(body.items[0]).toMatchObject({
          slug: "cat-teaser-wand",
          petType: "cat"
        });
      });
  });

  it("returns sellable recommendations when product discovery has no matches", async () => {
    await request(app.getHttpServer())
      .get("/api/products?q=moon-collar&petType=dog&maxPriceCents=100")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([]);
        expect(body.meta).toMatchObject({
          total: 0,
          recommendationReason:
            "No exact match found, so we surfaced active in-stock toys to keep checkout moving."
        });
        expect(body.meta.recommendedItems).toEqual([
          expect.objectContaining({
            slug: "cat-teaser-wand",
            status: "active"
          }),
          expect.objectContaining({
            slug: "durable-bite-rope",
            status: "active"
          })
        ]);
      });
  });

  it("matches product discovery tags in catalog search", async () => {
    await request(app.getHttpServer())
      .get("/api/products?q=daily-care")
      .expect(200)
      .expect(({ body }) => {
        expect(body.meta.total).toBe(1);
        expect(body.meta.availableTags).toEqual(
          expect.arrayContaining(["daily-care", "indoor-play"])
        );
        expect(body.items).toEqual([
          expect.objectContaining({
            slug: "durable-bite-rope",
            tags: expect.arrayContaining(["daily-care", "tug-play", "washable"])
          })
        ]);
      });

    await request(app.getHttpServer())
      .get("/api/products/durable-bite-rope")
      .expect(200)
      .expect(({ body }) => {
        expect(body.tags).toEqual(
          expect.arrayContaining(["daily-care", "tug-play", "washable"])
        );
      });
  });

  it("returns product detail with sellable variants", async () => {
    await request(app.getHttpServer())
      .get("/api/products/durable-bite-rope")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          slug: "durable-bite-rope",
          petType: "dog",
          status: "active"
        });
        expect(body.variants).toEqual([
          expect.objectContaining({
            skuCode: "DBR-GREEN-M",
            priceCents: 3990,
            stock: 50,
            isAvailable: true
          })
        ]);
      });
  });

  it("returns 404 for missing product detail", async () => {
    await request(app.getHttpServer())
      .get("/api/products/not-found")
      .expect(404)
      .expect(({ body }) => {
        expect(body.message).toBe("Product not found");
      });
  });

  it("creates a pending order from selected variants", async () => {
    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 2
          }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "pending_payment",
          totalCents: 7980,
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 2,
              unitPriceCents: 3990
            }
          ]
        });
        expect(body.orderNo).toMatch(/^KZT\d{18}$/);
      });
  });

  it("returns an order by order number", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13600137169"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13600137169",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          status: "pending_payment",
          totalCents: 3990
        });
      });
  });

  it("rejects order creation when quantity exceeds stock", async () => {
    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 999
          }
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Insufficient stock for SKU DBR-GREEN-M");
      });
  });

  it("creates an anonymous cart when adding the first item", async () => {
    await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.cartId).toMatch(/^cart_/);
        expect(body).toMatchObject({
          subtotalCents: 3990,
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 1,
              unitPriceCents: 3990,
              lineTotalCents: 3990
            }
          ]
        });
      });
  });

  it("returns an existing cart by id", async () => {
    const addResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 2
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/cart/${addResponse.body.cartId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          cartId: addResponse.body.cartId,
          subtotalCents: 7980,
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 2
            }
          ]
        });
      });
  });

  it("updates item quantity in an existing cart", async () => {
    const addResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch("/api/cart/items/DBR-GREEN-M")
      .send({
        cartId: addResponse.body.cartId,
        quantity: 3
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          cartId: addResponse.body.cartId,
          subtotalCents: 11970,
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 3,
              lineTotalCents: 11970
            }
          ]
        });
      });
  });

  it("rejects cart quantity that exceeds stock", async () => {
    await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 999
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Insufficient stock for SKU DBR-GREEN-M");
      });
  });

  it("creates a mock WeChat payment for a pending order", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          provider: "wechat",
          channel: "h5",
          amountCents: 3990,
          status: "pending"
        });
        expect(body.paymentNo).toMatch(/^PAY\d{14}\d{4}$/);
        expect(body.payUrl).toContain("/mock-pay/wechat/");
      });
  });

  it("creates a mock Alipay payment for a pending order", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/alipay")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          provider: "alipay",
          channel: "h5",
          amountCents: 3990,
          status: "pending"
        });
        expect(body.payUrl).toContain("/mock-pay/alipay/");
      });
  });

  it("marks payment and order paid from a WeChat notification", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const paymentResponse = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: paymentResponse.body.paymentNo,
        providerTradeNo: "wx_trade_001",
        paidAmountCents: 3990
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          success: true,
          orderNo: orderResponse.body.orderNo,
          paymentStatus: "paid",
          orderStatus: "paid"
        });
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("paid");
      });
  });

  it("creates and approves an after-sales refund request", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Refund Customer",
          phone: "13600136088"
        },
        address: {
          receiverName: "Refund Customer",
          phone: "13600136088",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const paymentResponse = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: paymentResponse.body.paymentNo,
        providerTradeNo: "wx_refund_trade_001",
        paidAmountCents: paymentResponse.body.amountCents
      })
      .expect(200);

    const refundResponse = await request(app.getHttpServer())
      .post("/api/after-sales/refunds")
      .send({
        orderNo: orderResponse.body.orderNo,
        reason: "Customer requested a refund after payment",
        requestedAmountCents: paymentResponse.body.amountCents
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          status: "pending_review",
          requestedAmountCents: paymentResponse.body.amountCents
        });
        expect(body.refundNo).toMatch(/^REF\d{14}/);
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("refunding");
      });

    await request(app.getHttpServer())
      .get("/api/admin/refunds")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              refundNo: refundResponse.body.refundNo,
              status: "pending_review",
              reviewSla: expect.objectContaining({
                policyHours: 24,
                status: "on_track",
                dueAt: expect.any(String),
                hoursUntilDue: expect.any(Number)
              })
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/refunds/${refundResponse.body.refundNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "approved",
        note: "Refund approved by merchant"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          refundNo: refundResponse.body.refundNo,
          status: "approved",
          refundedAmountCents: paymentResponse.body.amountCents
        });
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("refunded");
      });
  });

  it("prevents after-sales refunds from exceeding the remaining refundable balance", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Partial Refund Customer",
          phone: "13600136123"
        },
        address: {
          receiverName: "Partial Refund Customer",
          phone: "13600136123",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Partial Refund Road 2"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 2
          }
        ]
      })
      .expect(201);

    const paymentResponse = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: paymentResponse.body.paymentNo,
        providerTradeNo: "wx_partial_refund_trade",
        paidAmountCents: paymentResponse.body.amountCents
      })
      .expect(200);

    const firstRefund = await request(app.getHttpServer())
      .post("/api/after-sales/refunds")
      .send({
        orderNo: orderResponse.body.orderNo,
        reason: "Partial refund for one damaged item",
        requestedAmountCents: 3000
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/refunds")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              refundNo: firstRefund.body.refundNo,
              refundableBalanceCents: 7980,
              remainingAfterRequestCents: 4980,
              reviewRisk: {
                level: "low",
                priority: "normal",
                reason: "Request is within refundable balance"
              }
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/refunds/${firstRefund.body.refundNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "approved",
        note: "Partial refund approved"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.refundedAmountCents).toBe(3000);
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("paid");
      });

    await request(app.getHttpServer())
      .post("/api/after-sales/refunds")
      .send({
        orderNo: orderResponse.body.orderNo,
        reason: "Attempt to over-refund the remaining balance",
        requestedAmountCents: 6000
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Refund amount exceeds refundable balance");
      });

    const finalRefund = await request(app.getHttpServer())
      .post("/api/after-sales/refunds")
      .send({
        orderNo: orderResponse.body.orderNo,
        reason: "Refund the remaining paid balance",
        requestedAmountCents: 4980
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/refunds")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              refundNo: finalRefund.body.refundNo,
              refundableBalanceCents: 4980,
              remainingAfterRequestCents: 0,
              reviewSla: expect.objectContaining({
                policyHours: 24,
                status: "on_track",
                dueAt: expect.any(String),
                hoursUntilDue: expect.any(Number)
              }),
              reviewRisk: {
                level: "medium",
                priority: "expedite",
                reason: "Request will fully refund the order"
              }
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          pendingRefundCount: 1,
          expeditedRefundCount: 1,
          blockedRefundCount: 0,
          dueSoonRefundCount: 0,
          overdueRefundCount: 0,
          pendingRefundAmountCents: 4980
        });
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/refunds/${finalRefund.body.refundNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "approved",
        note: "Final refund approved"
      })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("refunded");
      });
  });

  it("rejects admin requests without an admin token", async () => {
    await request(app.getHttpServer()).get("/api/admin/products").expect(401);
    await request(app.getHttpServer())
      .get("/api/admin/pets/daily-diary-coverage")
      .expect(401);
  });

  it("logs in an admin, resolves the session, and protects admin routes", async () => {
    const loginResponse = await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({
        email: "owner@example.com",
        password: "owner123456"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.sessionToken).toMatch(/^admin_/);
        expect(body.staff).toMatchObject({
          staffNo: "STAFF_OWNER",
          role: "owner"
        });
      });

    await request(app.getHttpServer())
      .get("/api/admin/auth/me")
      .set("X-Admin-Session", loginResponse.body.sessionToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          staffNo: "STAFF_OWNER",
          role: "owner"
        });
      });

    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set("X-Admin-Session", loginResponse.body.sessionToken)
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Session", loginResponse.body.sessionToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              staffNo: "STAFF_OWNER",
              action: "security.admin_login",
              targetType: "admin_session",
              targetId: expect.stringMatching(/^[0-9a-f]{16}$/),
              summary: expect.not.stringContaining(
                loginResponse.body.sessionToken
              )
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .post("/api/admin/auth/logout")
      .set("X-Admin-Session", loginResponse.body.sessionToken)
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              staffNo: "STAFF_OWNER",
              action: "security.admin_logout",
              targetType: "admin_session",
              targetId: expect.stringMatching(/^[0-9a-f]{16}$/),
              summary: expect.not.stringContaining(
                loginResponse.body.sessionToken
              )
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/auth/me")
      .set("X-Admin-Session", loginResponse.body.sessionToken)
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid admin session");
      });
  });

  it("rejects disabled admins and preserves permission checks when using admin sessions", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/auth/login")
      .send({
        email: "disabled@example.com",
        password: "disabled123456"
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Admin account is disabled");
      });

    const operatorSession = await loginAsAdmin("operator");
    const ownerAdminSession = await loginAsAdmin("owner");

    await request(app.getHttpServer())
      .patch("/api/admin/products/durable-bite-rope/status")
      .set("X-Admin-Session", operatorSession)
      .send({ status: "archived" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: catalog:write");
      });
  });

  it("scopes admin staff permissions and records operation logs", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/staff/me")
      .set("X-Admin-Token", "ops-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          staffNo: "STAFF_OPS",
          role: "operator",
          permissions: expect.arrayContaining(["fulfillment:write"])
        });
        expect(body.permissions).not.toContain("catalog:write");
      });

    await request(app.getHttpServer())
      .patch("/api/admin/products/durable-bite-rope/status")
      .set("X-Admin-Token", "ops-admin-key")
      .send({ status: "archived" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: catalog:write");
      });

    await request(app.getHttpServer())
      .patch("/api/admin/products/variants/DBR-GREEN-M/stock")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ stock: 11 })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              staffNo: "STAFF_OWNER",
              action: "catalog.variant_stock.update",
              targetType: "product_variant",
              targetId: "DBR-GREEN-M"
            }),
            expect.objectContaining({
              staffNo: "STAFF_OPS",
              action: "security.permission_denied",
              targetType: "permission",
              targetId: "catalog:write",
              summary: expect.stringContaining(
                "Denied Operations Admin access to catalog:write"
              )
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.operationLogCount).toBeGreaterThanOrEqual(2);
        expect(body.highRiskOperationCount).toBeGreaterThanOrEqual(2);
        expect(body.permissionDeniedCount).toBeGreaterThanOrEqual(1);
      });
  });

  it("publishes CMS blocks into public homepage slots with staff audit logs", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/cms/blocks")
      .set("X-Admin-Token", "ops-admin-key")
      .send({
        slotKey: "homepage.campaign",
        title: "Ops should not publish",
        body: "Operators cannot publish CMS campaign content.",
        status: "published"
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: cms:write");
      });

    const blockResponse = await request(app.getHttpServer())
      .post("/api/admin/cms/blocks")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        slotKey: "homepage.campaign",
        title: "Naigai and Niangao daily growth campaign",
        body: "Recommend interactive toys and cloud-pet tasks from today's growth diary.",
        ctaLabel: "Visit shop",
        href: "/shop",
        imageUrl: "/brand/naigai-niangao/naigai-standard.png",
        status: "published",
        sortOrder: 1
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          slotKey: "homepage.campaign",
          title: "Naigai and Niangao daily growth campaign",
          status: "published"
        });
        expect(body.blockNo).toMatch(/^CMS\d{14}\d{4}$/);
      });

    await request(app.getHttpServer())
      .get("/api/cms/slots/homepage")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              blockNo: blockResponse.body.blockNo,
              slotKey: "homepage.campaign",
              title: "Naigai and Niangao daily growth campaign",
              href: "/shop"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/cms/blocks/${blockResponse.body.blockNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "archived" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          blockNo: blockResponse.body.blockNo,
          status: "archived"
        });
      });

    await request(app.getHttpServer())
      .get("/api/cms/slots/homepage")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              blockNo: blockResponse.body.blockNo
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "cms.block.create",
              targetType: "cms_block",
              targetId: blockResponse.body.blockNo
            }),
            expect.objectContaining({
              action: "cms.block_status.update",
              targetType: "cms_block",
              targetId: blockResponse.body.blockNo
            })
          ])
        );
      });
  });

  it("lists products for an authenticated admin", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/products")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            slug: "durable-bite-rope",
            variants: [
              expect.objectContaining({
                skuCode: "DBR-GREEN-M",
                stock: expect.any(Number),
                isAvailable: true
              })
            ]
          }),
          expect.objectContaining({
            slug: "cat-teaser-wand"
          })
        ]);
      });
  });

  it("lists orders and updates order status for an authenticated admin", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/orders")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              orderNo: orderResponse.body.orderNo,
              status: "pending_payment"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${orderResponse.body.orderNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "shipped"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          status: "shipped"
        });
      });
  });

  it("returns admin dashboard metrics for merchant operations", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Dashboard Owner"))
      .send({
        ownerName: "Dashboard Owner",
        ownerPhone: "13800138000",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    const dashboardCommunitySession = await loginAsMember("13800138000", "Dashboard Owner");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", dashboardCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Dashboard Owner",
        body: "Today the ops kitten completed a community interaction.",
      })
      .expect(201);

    const dashboardPaymentSession = await loginAsMember(
      "13600136288",
      "Dashboard Payment Customer"
    );
    const failedPaymentOrder = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Dashboard Payment Customer",
          phone: "13600136288"
        },
        address: {
          receiverName: "Dashboard Payment Customer",
          phone: "13600136288",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Dashboard Payment Street"
        },
        items: [{ skuCode: "DBR-GREEN-M", quantity: 1 }]
      })
      .expect(201);
    const failedPaymentIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", dashboardPaymentSession)
      .send({
        orderId: failedPaymentOrder.body.orderNo,
        provider: "mock_wechat"
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/payments/${failedPaymentIntent.body.id}/confirm`)
      .set("X-Member-Token", dashboardPaymentSession)
      .send({ result: "failed", failureCode: "PAYMENT_DECLINED" })
      .expect(201);

    const pendingPaymentOrder = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Dashboard Payment Customer",
          phone: "13600136288"
        },
        address: {
          receiverName: "Dashboard Payment Customer",
          phone: "13600136288",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Dashboard Pending Payment Street"
        },
        items: [{ skuCode: "CTW-BASIC", quantity: 1 }]
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", dashboardPaymentSession)
      .send({
        orderId: pendingPaymentOrder.body.orderNo,
        provider: "mock_alipay"
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          activeProductCount: 2,
          cloudPetCount: expect.any(Number),
          dailyDiaryCoveredCount: expect.any(Number),
          dailyDiaryMissingCount: expect.any(Number),
          dailyDiaryCoverageRate: expect.any(Number),
          communityPostCount: expect.any(Number),
          orderCount: expect.any(Number),
          pendingOrderCount: expect.any(Number),
          paymentIntentCount: expect.any(Number),
          pendingPaymentIntentCount: expect.any(Number),
          failedPaymentIntentCount: expect.any(Number),
          overduePaymentIntentCount: expect.any(Number),
          memberVerificationIssuedCount: expect.any(Number),
          memberVerificationSuccessCount: expect.any(Number),
          memberVerificationActiveCount: expect.any(Number),
          memberVerificationExpiredCount: expect.any(Number),
          memberVerificationLockedCount: expect.any(Number),
          memberVerificationFailedAttemptCount: expect.any(Number),
          memberVerificationSuccessRate: expect.any(Number),
          hiddenCommunityPostCount: 0
        });
        expect(body.cloudPetCount).toBeGreaterThanOrEqual(1);
        expect(body.dailyDiaryMissingCount).toBeGreaterThanOrEqual(1);
        expect(body.dailyDiaryCoveredCount + body.dailyDiaryMissingCount).toBe(
          body.cloudPetCount
        );
        expect(body.communityPostCount).toBeGreaterThanOrEqual(1);
        expect(body.paymentIntentCount).toBeGreaterThanOrEqual(2);
        expect(body.pendingPaymentIntentCount).toBeGreaterThanOrEqual(1);
        expect(body.failedPaymentIntentCount).toBeGreaterThanOrEqual(1);
        expect(body.memberVerificationIssuedCount).toBeGreaterThanOrEqual(3);
        expect(body.memberVerificationSuccessCount).toBeGreaterThanOrEqual(3);
      });
  });

  it("returns merchant analytics for revenue, repeat purchase, and product rankings", async () => {
    const phone = "13600136988";

    for (const index of [1, 2]) {
      const orderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .send({
          customer: {
            name: "Analytics Customer",
            phone
          },
          address: {
            receiverName: "Analytics Customer",
            phone,
            province: "Guangdong",
            city: "Shenzhen",
            district: "Nanshan",
            detail: `Science Park ${index}`
          },
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 1
            }
          ]
        })
        .expect(201);
      const paymentResponse = await request(app.getHttpServer())
        .post("/api/payments/wechat")
        .send({
          orderNo: orderResponse.body.orderNo,
          channel: "h5"
        })
        .expect(201);

      await request(app.getHttpServer())
        .post("/api/payments/wechat/notify")
        .send({
          paymentNo: paymentResponse.body.paymentNo,
          providerTradeNo: `wx_analytics_${index}`,
          paidAmountCents: paymentResponse.body.amountCents
        })
        .expect(200);
    }

    const analyticsPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(phone, "Analytics Pet Owner"))
      .send({
        ownerName: "Analytics Pet Owner",
        ownerPhone: phone,
        name: "Analytics Visit Pet",
        species: "dog",
        personality: "turns homepage visits into analytics"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${analyticsPetResponse.body.petNo}/homepage/visits`)
      .send({
        source: "analytics_test",
        visitorId: "analytics_visitor_20260723"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13600136989", "Activation Pet Owner"))
      .send({
        ownerName: "Activation Pet Owner",
        ownerPhone: "13600136989",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/analytics")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.revenue).toMatchObject({
          gmvCents: expect.any(Number),
          paidOrderCount: expect.any(Number),
          averageOrderValueCents: expect.any(Number)
        });
        expect(body.revenue.gmvCents).toBeGreaterThanOrEqual(7980);
        expect(body.conversion.paidOrderRate).toBeGreaterThan(0);
        expect(body.customers.repeatCustomerCount).toBeGreaterThanOrEqual(1);
        expect(body.productRankings).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              skuCode: "DBR-GREEN-M",
              quantitySold: expect.any(Number),
              revenueCents: expect.any(Number)
            })
          ])
        );
        expect(body.retentionSignals).toMatchObject({
          cloudPetCount: expect.any(Number),
          homepageVisitCount: expect.any(Number),
          communityPostCount: expect.any(Number),
          reviewCount: expect.any(Number)
        });
        expect(body.retentionSignals.homepageVisitCount).toBeGreaterThanOrEqual(1);
        expect(body.customerSegments).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: "high_value_pet_parent",
              memberCount: expect.any(Number),
              samplePhones: expect.arrayContaining([phone]),
              actionLabel: "Send VIP bundle offer"
            }),
            expect.objectContaining({
              key: "pet_parent_activation",
              memberCount: expect.any(Number),
              samplePhones: expect.arrayContaining(["13600136989"]),
              actionLabel: "Push first-order coupon"
            })
          ])
        );
        expect(body.retentionFunnel).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: "cloud_pet_created",
              count: expect.any(Number),
              conversionRate: 100,
              actionLabel: "Keep pet onboarding active"
            }),
            expect.objectContaining({
              key: "homepage_engaged",
              count: expect.any(Number),
              conversionRate: expect.any(Number),
              dropOffCount: expect.any(Number),
              actionLabel: "Promote shareable homepage"
            }),
            expect.objectContaining({
              key: "order_created",
              count: expect.any(Number),
              conversionRate: expect.any(Number),
              actionLabel: "Nudge cart and checkout"
            }),
            expect.objectContaining({
              key: "paid_customer",
              count: expect.any(Number),
              conversionRate: expect.any(Number),
              actionLabel: "Issue post-purchase task"
            }),
            expect.objectContaining({
              key: "repeat_customer",
              count: expect.any(Number),
              conversionRate: expect.any(Number),
              actionLabel: "Offer VIP bundle"
            })
          ])
        );
        expect(
          body.retentionFunnel.find(
            (stage: { key: string }) => stage.key === "cloud_pet_created"
          ).count
        ).toBeGreaterThanOrEqual(2);
      });
  });

  it("returns admin customer CRM profiles with tags, notes, and follow-ups", async () => {
    const phone = "13600137988";
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "CRM Customer",
          phone
        },
        address: {
          receiverName: "CRM Customer",
          phone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "CRM Street 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);
    const paymentResponse = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: orderResponse.body.orderNo,
        channel: "h5"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: paymentResponse.body.paymentNo,
        providerTradeNo: "wx_crm_customer",
        paidAmountCents: paymentResponse.body.amountCents
      })
      .expect(200);

    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(phone, "CRM Customer"))
      .send({
        ownerName: "CRM Customer",
        ownerPhone: phone,
        name: "CRM Segment Pet",
        species: "dog",
        personality: "needs merchant follow-up"
      })
      .expect(201);

    const crmCommunitySession = await loginAsMember(phone, "CRM Customer");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", crmCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "CRM Customer",
        body: "CRM customer shared a pet growth moment."
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/admin/customers/${phone}/crm`)
      .set("X-Admin-Token", "ops-admin-key")
      .send({
        tags: ["vip_candidate"],
        note: "Operator should not update CRM."
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: customers:write");
      });

    await request(app.getHttpServer())
      .post(`/api/admin/customers/${phone}/follow-ups`)
      .set("X-Admin-Token", "ops-admin-key")
      .send({
        type: "wechat",
        summary: "Operator should not log follow-up."
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: customers:write");
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/customers/${phone}/crm`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        tags: ["vip_candidate", "cloud_pet_parent"],
        note: "Prefers cloud-pet bundles and follow-up through WeChat.",
        ownerStaffName: "Owner Admin"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.crm).toMatchObject({
          tags: expect.arrayContaining(["vip_candidate", "cloud_pet_parent"]),
          note: "Prefers cloud-pet bundles and follow-up through WeChat.",
          ownerStaffName: "Owner Admin"
        });
      });

    await request(app.getHttpServer())
      .post(`/api/admin/customers/${phone}/follow-ups`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        type: "wechat",
        summary: "Sent VIP bundle recommendation after pet homepage activity.",
        nextActionAt: "2026-06-03T10:00:00.000Z"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.followUpNo).toMatch(/^FU\d{14}/);
        expect(body.summary).toContain("VIP bundle");
      });

    await request(app.getHttpServer())
      .get("/api/admin/customers")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              phone,
              name: "CRM Customer",
              paidOrderCount: 1,
              petCount: 1,
              communityPostCount: 1,
              tags: expect.arrayContaining(["vip_candidate"])
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/admin/customers/${phone}`)
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          phone,
          name: "CRM Customer",
          summary: {
            orderCount: 1,
            paidOrderCount: 1,
            petCount: 1,
            communityPostCount: 1
          },
          crm: {
            tags: expect.arrayContaining(["vip_candidate"]),
            followUps: [
              expect.objectContaining({
                type: "wechat",
                summary: expect.stringContaining("VIP bundle")
              })
            ]
          },
          nextBestAction: {
            key: expect.any(String),
            ctaLabel: expect.any(String)
          }
        });
        expect(body.pets).toEqual([
          expect.objectContaining({ petNo: petResponse.body.petNo })
        ]);
        expect(body.orders).toEqual([
          expect.objectContaining({ orderNo: orderResponse.body.orderNo })
        ]);
      });
  });

  it("lets an authenticated admin list cloud pets and hide community posts", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Moderation Owner"))
      .send({
        ownerName: "Moderation Owner",
        ownerPhone: "13800138000",
        name: "Moderation Pet",
        species: "dog",
        personality: "shares community posts often"
      })
      .expect(201);

    const moderationCommunitySession = await loginAsMember("13800138000", "Moderation Owner");

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", moderationCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Moderation Owner",
        body: "This content needs merchant moderation before it can be hidden.",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              name: "Moderation Pet",
              communityPostCount: 1
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets?q=Moderation&species=dog")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          filters: { q: "Moderation", species: "dog" },
          filteredCount: expect.any(Number),
          totalCount: expect.any(Number)
        });
        expect(body.items).toEqual([
          expect.objectContaining({
            petNo: petResponse.body.petNo,
            species: "dog"
          })
        ]);
      });
    await request(app.getHttpServer())
      .patch(`/api/admin/community/posts/${postResponse.body.postNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "hidden" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          postNo: postResponse.body.postNo,
          status: "hidden"
        });
      });

    await request(app.getHttpServer())
      .get("/api/community/posts")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              postNo: postResponse.body.postNo
            })
          ])
        );
      });
  });

  it("returns cloud-pet retention metrics for admin operations", async () => {
    const caredPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138234", "Retention Owner"))
      .send({
        ownerName: "Retention Owner",
        ownerPhone: "13800138234",
        name: "Retention Pet",
        species: "dog",
        personality: "likes daily care loops"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138235", "Retention Missing Owner"))
      .send({
        ownerName: "Retention Missing Owner",
        ownerPhone: "13800138235",
        name: "Retention Missing Pet",
        species: "cat",
        personality: "waits for the first care action"
      })
      .expect(201);

    const ownerSession = await loginAsMember("13800138234", "Retention Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${caredPetResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", ownerSession)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${caredPetResponse.body.petNo}/homepage/visits`)
      .send({
        source: "retention-metrics-test",
        visitorId: "retention_visitor_20260723"
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets/retention-metrics")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalPetCount).toBeGreaterThanOrEqual(2);
        expect(body.careCompletedTodayCount).toBeGreaterThanOrEqual(1);
        expect(body.careCompletionRate).toBeGreaterThan(0);
        expect(body.averageCareScore).toBeGreaterThanOrEqual(0);
        expect(body.maxCareStreakDays).toBeGreaterThanOrEqual(1);
        expect(body.careStateCounts).toEqual(
          expect.objectContaining({
            needsCare: expect.any(Number),
            steady: expect.any(Number),
            thriving: expect.any(Number)
          })
        );
        expect(body.dailyDiaryCoverageRate).toBeGreaterThanOrEqual(0);
        expect(body.homepageVisitCount).toBeGreaterThanOrEqual(1);
      });
  });

  it("returns cloud-pet growth task operations for admin review", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138345", "Task Ops Owner"))
      .send({
        ownerName: "Task Ops Owner",
        ownerPhone: "13800138345",
        name: "Task Ops Pet",
        species: "dog",
        personality: "keeps task operations visible"
      })
      .expect(201);

    const ownerSession = await loginAsMember("13800138345", "Task Ops Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", ownerSession)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/feed-care/complete`)
      .set("X-Member-Token", ownerSession)
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets/growth-tasks")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalPetCount).toBeGreaterThanOrEqual(1);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: "daily-care",
              completedTodayCount: expect.any(Number),
              completionRate: expect.any(Number)
            }),
            expect.objectContaining({
              key: "feed-care",
              completedTodayCount: expect.any(Number),
              completionRate: expect.any(Number)
            })
          ])
        );
        const dailyCare = body.items.find((item: { key: string }) => item.key === "daily-care");
        const feedCare = body.items.find((item: { key: string }) => item.key === "feed-care");
        expect(dailyCare.completedTodayCount).toBeGreaterThanOrEqual(1);
        expect(feedCare.completedTodayCount).toBeGreaterThanOrEqual(1);
      });
  });

  it("updates cloud-pet growth task templates for admin operations", async () => {
    const ownerSession = await loginAsAdmin("owner");
    const operatorSession = await loginAsAdmin("operator");

    await request(app.getHttpServer())
      .patch("/api/admin/cloud-pets/growth-tasks/daily-care")
      .set("X-Admin-Session", operatorSession)
      .send({ points: 26 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: cloud_pets:write");
      });

    try {
      await request(app.getHttpServer())
        .patch("/api/admin/cloud-pets/growth-tasks/daily-care")
        .set("X-Admin-Session", ownerSession)
        .send({
          points: 26,
          rewards: { mood: 1, energy: 1, intimacy: 1 }
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            key: "daily-care",
            points: 26,
            rewards: { mood: 1, energy: 1, intimacy: 1 }
          });
        });

      await request(app.getHttpServer())
        .get("/api/admin/cloud-pets/growth-tasks")
        .set("X-Admin-Session", ownerSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                key: "daily-care",
                points: 26,
                rewards: { mood: 1, energy: 1, intimacy: 1 }
              })
            ])
          );
        });

      const petResponse = await request(app.getHttpServer())
        .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138347", "Task Template Owner"))
        .send({
          ownerName: "Task Template Owner",
          ownerPhone: "13800138347",
          name: "Task Template Pet",
          species: "cat",
          personality: "reflects growth task template changes"
        })
        .expect(201);
      const memberSession = await loginAsMember("13800138347", "Task Template Owner");

      await request(app.getHttpServer())
        .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
        .set("X-Member-Token", memberSession)
        .expect(201)
        .expect(({ body }) => {
          expect(body.completedTask).toMatchObject({ key: "daily-care", points: 26 });
          expect(body.pet.stats).toMatchObject({ mood: 73, energy: 69, intimacy: 16 });
        });

      await request(app.getHttpServer())
        .get("/api/admin/operation-logs")
        .set("X-Admin-Session", ownerSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                action: "cloud_pets.growth_task_template.update",
                targetId: "daily-care",
                staffNo: "STAFF_OWNER"
              })
            ])
          );
        });
    } finally {
      await request(app.getHttpServer())
        .patch("/api/admin/cloud-pets/growth-tasks/daily-care")
        .set("X-Admin-Session", ownerSession)
        .send({
          points: 20,
          rewards: { mood: 8, energy: 4, intimacy: 10 }
        });
    }
  });
  it("updates cloud-pet care score rules for admin operations", async () => {
    const ownerSession = await loginAsAdmin("owner");
    const operatorSession = await loginAsAdmin("operator");

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets/care-score-rules")
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          dailyTaskBonus: 12,
          steadyMinScore: 60,
          thrivingMinScore: 70,
          thrivingRequiresCareToday: true
        });
      });

    await request(app.getHttpServer())
      .patch("/api/admin/cloud-pets/care-score-rules")
      .set("X-Admin-Session", operatorSession)
      .send({ dailyTaskBonus: 0 })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Missing admin permission: cloud_pets:write");
      });

    try {
      await request(app.getHttpServer())
        .patch("/api/admin/cloud-pets/care-score-rules")
        .set("X-Admin-Session", ownerSession)
        .send({
          dailyTaskBonus: 0,
          steadyMinScore: 60,
          thrivingMinScore: 95,
          thrivingRequiresCareToday: true
        })
        .expect(200)
        .expect(({ body }) => {
          expect(body).toMatchObject({
            dailyTaskBonus: 0,
            steadyMinScore: 60,
            thrivingMinScore: 95,
            thrivingRequiresCareToday: true
          });
          expect(body.updatedAt).toEqual(expect.any(String));
        });

      const petResponse = await request(app.getHttpServer())
        .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138346", "Care Rules Owner"))
        .send({
          ownerName: "Care Rules Owner",
          ownerPhone: "13800138346",
          name: "Care Rules Pet",
          species: "dog",
          personality: "reflects care score rule changes"
        })
        .expect(201);
      const memberSession = await loginAsMember("13800138346", "Care Rules Owner");

      await request(app.getHttpServer())
        .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
        .set("X-Member-Token", memberSession)
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/cloud-pets/${petResponse.body.petNo}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.growth.careScore).toBeLessThan(60);
          expect(body.growth.careState).toBe("needs_care");
        });

      await request(app.getHttpServer())
        .get("/api/admin/operation-logs")
        .set("X-Admin-Session", ownerSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                action: "cloud_pets.care_score_rules.update",
                staffNo: "STAFF_OWNER",
                staffName: "Owner Admin"
              })
            ])
          );
        });
    } finally {
      await request(app.getHttpServer())
        .patch("/api/admin/cloud-pets/care-score-rules")
        .set("X-Admin-Session", ownerSession)
        .send({
          dailyTaskBonus: 12,
          steadyMinScore: 60,
          thrivingMinScore: 70,
          thrivingRequiresCareToday: true
        });
    }
  });
  it("lets an authenticated admin remove a public owner diary note", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138348", "Admin Diary Owner"))
      .send({
        ownerName: "Admin Diary Owner",
        ownerPhone: "13800138348",
        name: "Admin Diary Pet",
        species: "cat",
        personality: "needs admin diary moderation"
      })
      .expect(201);
    const memberSession = await loginAsMember("13800138348", "Admin Diary Owner");
    const operatorSession = await loginAsAdmin("operator");
    const ownerAdminSession = await loginAsAdmin("owner");

    const noteResponse = await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", memberSession)
      .send({
        title: "Public owner note",
        body: "This public owner note should be removable by admin moderation."
      })
      .expect(201);
    const noteId = noteResponse.body.timeline[0].id;

    await request(app.getHttpServer())
      .get(`/api/admin/cloud-pets/${petResponse.body.petNo}/detail`)
      .set("X-Admin-Session", operatorSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.diary.latestOwnerNote).toMatchObject({
          id: noteId,
          type: "owner_note"
        });
      });

    await request(app.getHttpServer())
      .delete(`/api/admin/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Admin-Session", operatorSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.timeline).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: noteId })])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=owner_note`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(0);
        expect(body.filters).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ key: "owner_note" })])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Session", ownerAdminSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "cloud_pets.diary_note.remove",
              targetId: noteId,
              staffNo: "STAFF_OPS"
            })
          ])
        );
      });

  });
  it("returns a cloud-pet operational detail for admin review", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138123", "Detail Owner"))
      .send({
        ownerName: "Detail Owner",
        ownerPhone: "13800138123",
        name: "Detail Pet",
        species: "cat",
        personality: "keeps a tidy operating record"
      })
      .expect(201);

    const ownerSession = await loginAsMember("13800138123", "Detail Owner");

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Detail Owner",
        body: "A detail page should show this community context."
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", ownerSession)
      .send({
        reporterName: "Detail Owner",
        reason: "Needs merchant review"
      })
      .expect(201);

    const secondPostResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Detail Owner",
        body: "A second report target should remain visible in the detail projection."
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${secondPostResponse.body.postNo}/reports`)
      .set("X-Member-Token", ownerSession)
      .send({
        reporterName: "Detail Owner",
        reason: "Needs a second merchant review"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", ownerSession)
      .send({
        title: "Owner field note",
        body: "This owner note should appear in the operational archive."
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "admin-detail-test",
        visitorId: "admin_detail_visitor_20260723"
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/admin/cloud-pets/${petResponse.body.petNo}/detail`)
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.pet).toMatchObject({
          petNo: petResponse.body.petNo,
          name: "Detail Pet",
          ownerPhone: "13800138123"
        });
        expect(body.archive.engagement.homepageVisitCount).toBeGreaterThanOrEqual(1);
        expect(body.community).toMatchObject({
          postCount: 2,
          reportCount: 2,
          pendingReportCount: 2,
          pendingReportPostNos: [
            postResponse.body.postNo,
            secondPostResponse.body.postNo
          ].sort()
        });
        expect(body.community.posts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ postNo: postResponse.body.postNo }),
            expect.objectContaining({ postNo: secondPostResponse.body.postNo })
          ])
        );
        expect(body.diary.entryCount).toBeGreaterThanOrEqual(1);
        expect(body.diary.latestEntry).toEqual(
          expect.objectContaining({ title: "Owner field note" })
        );
      });
  });

  it("lets an authenticated admin update product inventory and catalog status", async () => {
    await request(app.getHttpServer())
      .patch("/api/admin/products/variants/DBR-GREEN-M/stock")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ stock: 7 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          skuCode: "DBR-GREEN-M",
          stock: 7,
          isAvailable: true
        });
      });

    await request(app.getHttpServer())
      .patch("/api/admin/products/durable-bite-rope/status")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "archived" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          slug: "durable-bite-rope",
          status: "archived"
        });
      });

    await request(app.getHttpServer())
      .get("/api/products")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ slug: "durable-bite-rope" })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch("/api/admin/products/durable-bite-rope/status")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "active" })
      .expect(200);

    await request(app.getHttpServer())
      .patch("/api/admin/products/variants/DBR-GREEN-M/stock")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ stock: 50 })
      .expect(200);
  });

  it("lets an authenticated admin create a sellable product and exposes low stock signals", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        slug: "merchant-training-ball",
        title: "Merchant training ball",
        description: "A merchant-created toy for testing catalog operations.",
        petType: "dog",
        toyType: "training",
        status: "active",
        images: ["/brand/naigai-niangao/niangao-toy.png"],
        variants: [
          {
            skuCode: "MTB-RED-S",
            name: "Red / Small",
            color: "red",
            size: "S",
            material: "rubber",
            priceCents: 2590,
            compareAtCents: 2990,
            stock: 3
          }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          slug: "merchant-training-ball",
          status: "active",
          priceCents: 2590,
          variants: [
            expect.objectContaining({
              skuCode: "MTB-RED-S",
              stock: 3,
              isAvailable: true
            })
          ]
        });
      });

    await request(app.getHttpServer())
      .get("/api/products")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              slug: "merchant-training-ball",
              priceCents: 2590
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/dashboard")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.lowStockVariantCount).toBeGreaterThanOrEqual(1);
      });

    await request(app.getHttpServer())
      .get("/api/admin/inventory/low-stock")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              skuCode: "MTB-RED-S",
              stock: 3,
              threshold: 5
            })
          ])
        );
      });
  });

  it("locks stock on order creation and releases it on cancellation or approved refund", async () => {
    await request(app.getHttpServer())
      .post("/api/admin/products")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        slug: "inventory-hardening-ball",
        title: "Inventory hardening ball",
        description: "A low-stock item used to verify reservation behavior.",
        petType: "dog",
        toyType: "training",
        status: "active",
        images: ["/brand/naigai-niangao/niangao-toy.png"],
        variants: [
          {
            skuCode: "IHB-LOCK-1",
            name: "Locked stock test",
            priceCents: 1990,
            stock: 2
          }
        ]
      })
      .expect(201);

    const cancelledOrder = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Inventory Customer",
          phone: "13600136188"
        },
        address: {
          receiverName: "Inventory Customer",
          phone: "13600136188",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "IHB-LOCK-1",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/inventory/low-stock")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              skuCode: "IHB-LOCK-1",
              stock: 1
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${cancelledOrder.body.orderNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "cancelled" })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/admin/inventory/low-stock")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              skuCode: "IHB-LOCK-1",
              stock: 2
            })
          ])
        );
      });

    const refundOrder = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Inventory Refund Customer",
          phone: "13600136189"
        },
        address: {
          receiverName: "Inventory Refund Customer",
          phone: "13600136189",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "IHB-LOCK-1",
            quantity: 1
          }
        ]
      })
      .expect(201);
    const refundPayment = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: refundOrder.body.orderNo,
        channel: "h5"
      })
      .expect(201);
    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: refundPayment.body.paymentNo,
        providerTradeNo: "wx_inventory_refund",
        paidAmountCents: refundPayment.body.amountCents
      })
      .expect(200);
    const refund = await request(app.getHttpServer())
      .post("/api/after-sales/refunds")
      .send({
        orderNo: refundOrder.body.orderNo,
        reason: "Restock after approved refund",
        requestedAmountCents: refundPayment.body.amountCents
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/admin/refunds/${refund.body.refundNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "approved", note: "Restock approved" })
      .expect(200);

    await request(app.getHttpServer())
      .get("/api/admin/inventory/low-stock")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              skuCode: "IHB-LOCK-1",
              stock: 2
            })
          ])
        );
      });
  });

  it("lets an authenticated admin fulfill a paid order with shipment tracking", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Fulfillment Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Fulfillment Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        carrier: "SF Express",
        trackingNumber: "SF1234567890"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          status: "shipped",
          shipment: {
            carrier: "SF Express",
            trackingNumber: "SF1234567890"
          }
        });
      });
  });

  it("records shipment events and exposes customer-facing tracking details", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Tracking Customer",
          phone: "13600136288"
        },
        address: {
          receiverName: "Tracking Customer",
          phone: "13600136288",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        carrier: "SF Express",
        trackingNumber: "SFTRACK123456"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments/events`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "out_for_delivery",
        location: "Shenzhen Nanshan service point",
        description: "Courier is dispatching the parcel",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments/events`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "delivered",
        location: "Shenzhen Nanshan service point",
        description: "Package delivered to the service point and signed.",
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe("completed");
        expect(body.shipment).toMatchObject({
          carrier: "SF Express",
          trackingNumber: "SFTRACK123456",
          status: "delivered",
          events: expect.arrayContaining([
            expect.objectContaining({
              status: "in_transit"
            }),
            expect.objectContaining({
              status: "delivered"
            })
          ])
        });
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}/tracking`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          orderStatus: "completed",
          currentStatus: "delivered",
          shipment: {
            carrier: "SF Express",
            trackingNumber: "SFTRACK123456"
          }
        });
        expect(body.events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              status: "out_for_delivery",
              location: "Shenzhen Nanshan service point",
            }),
            expect.objectContaining({
              status: "delivered",
              location: "Shenzhen Nanshan service point"
            })
          ])
        );
      });
  });

  it("collects product reviews after delivery and moderates them for the storefront", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Review Customer",
          phone: "13600136488"
        },
        address: {
          receiverName: "Review Customer",
          phone: "13600136488",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        carrier: "SF Express",
        trackingNumber: "SFREVIEW123456"
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments/events`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "delivered",
        location: "Shenzhen Nanshan service point",
        description: "Review test order has been signed",
      })
      .expect(201);

    const reviewResponse = await request(app.getHttpServer())
      .post("/api/reviews")
      .send({
        orderNo: orderResponse.body.orderNo,
        skuCode: "DBR-GREEN-M",
        rating: 5,
        body: "The durable rope is suitable for Naigai and stayed intact after long play.",
        authorName: "Review Customer"
      })
      .expect(201);

    expect(reviewResponse.body).toMatchObject({
      orderNo: orderResponse.body.orderNo,
      skuCode: "DBR-GREEN-M",
      productSlug: "durable-bite-rope",
      rating: 5,
      status: "pending_review"
    });

    await request(app.getHttpServer())
      .get("/api/admin/reviews")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reviewNo: reviewResponse.body.reviewNo,
              status: "pending_review"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/reviews/${reviewResponse.body.reviewNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "visible" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          reviewNo: reviewResponse.body.reviewNo,
          status: "visible"
        });
      });

    await request(app.getHttpServer())
      .get("/api/products/durable-bite-rope/reviews")
      .expect(200)
      .expect(({ body }) => {
        expect(body.summary).toMatchObject({
          averageRating: 5,
          reviewCount: 1
        });
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reviewNo: reviewResponse.body.reviewNo,
              rating: 5,
              body: "The durable rope is suitable for Naigai and stayed intact after long play.",
            })
          ])
        );
      });
  });

  it("returns member notifications for orders, delivery, reviews, growth, and coupons", async () => {
    const memberPhone = "13600136588";
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Notification Owner"))
      .send({
        ownerName: "Notification Owner",
        ownerPhone: memberPhone,
        name: "Notification Buddy",
        species: "dog",
        personality: "Loves daily care check-ins and playful updates",
      })
      .expect(201);

    const notificationMemberSession = await loginAsMember(memberPhone, "Notification Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", notificationMemberSession)
      .expect(201);

    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Notification Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Notification Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        carrier: "SF Express",
        trackingNumber: "SFNOTICE123456"
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/admin/orders/${orderResponse.body.orderNo}/shipments/events`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "delivered",
        location: "Shenzhen Nanshan service point",
        description: "Notification test order has been signed",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/members/${memberPhone}`)
      .set("X-Member-Token", notificationMemberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.notifications).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "coupon_available",
              actionHref: "/shop"
            }),
            expect.objectContaining({
              type: "growth_task_completed",
              sourceId: petResponse.body.petNo
            }),
            expect.objectContaining({
              type: "shipment_delivered",
              sourceId: orderResponse.body.orderNo
            }),
            expect.objectContaining({
              type: "review_request",
              sourceId: orderResponse.body.orderNo
            })
          ])
        );
      });
  });

  it("lets an authenticated admin manage coupon status for checkout campaigns", async () => {
    await request(app.getHttpServer())
      .get("/api/admin/coupons")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              code: "WELCOME20",
              status: "active",
              discountType: "fixed_amount",
              discountValueCents: 2000,
              minSpendCents: 0,
              usageLimitPerMember: 1,
              usageCount: expect.any(Number)
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .patch("/api/admin/coupons/WELCOME20/status")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "paused" })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: "WELCOME20",
          status: "paused"
        });
      });

    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        couponCode: "WELCOME20",
        customer: {
          name: "Paused Coupon Customer",
          phone: "13600136077"
        },
        address: {
          receiverName: "Paused Coupon Customer",
          phone: "13600136077",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Coupon is not active");
      });

    await request(app.getHttpServer())
      .patch("/api/admin/coupons/WELCOME20/status")
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "active" })
      .expect(200);
  });

  it("checks out a cart into a pending order and clears the cart", async () => {
    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 2
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13600137169"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13600137169",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          status: "pending_payment",
          totalCents: 7980,
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 2,
              unitPriceCents: 3990
            }
          ]
        });
        expect(body.orderNo).toMatch(/^KZT\d{18}$/);
      });

    await request(app.getHttpServer())
      .get(`/api/cart/${cartResponse.body.cartId}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          cartId: cartResponse.body.cartId,
          subtotalCents: 0,
          items: []
        });
      });
  });

  it("applies a member welcome coupon when checking out a cart", async () => {
    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        couponCode: "WELCOME20",
        customer: {
          name: "Coupon Customer",
          phone: "13600136066"
        },
        address: {
          receiverName: "Coupon Customer",
          phone: "13600136066",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          couponCode: "WELCOME20",
          discountCents: 2000,
          subtotalCents: 3990,
          totalCents: 1990
        });
      });
  });

  it("rejects reuse of the member welcome coupon by the same customer", async () => {
    const memberPhone = "13600136069";

    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        couponCode: "WELCOME20",
        customer: {
          name: "Welcome Reuse Customer",
          phone: memberPhone
        },
        address: {
          receiverName: "Welcome Reuse Customer",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const secondCart = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "CTW-BASIC",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${secondCart.body.cartId}/checkout`)
      .send({
        couponCode: "WELCOME20",
        customer: {
          name: "Welcome Reuse Customer",
          phone: memberPhone
        },
        address: {
          receiverName: "Welcome Reuse Customer",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 2"
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Coupon has already been used by this member");
      });
  });

  it("rejects checkout when non-stackable coupons are combined", async () => {
    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 2
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        couponCode: "WELCOME20",
        couponCodes: ["WELCOME20", "POINTS8"],
        customer: {
          name: "Coupon Stack Customer",
          phone: "13600136067"
        },
        address: {
          receiverName: "Coupon Stack Customer",
          phone: "13600136067",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Coupon combination is not allowed");
      });
  });

  it("applies member tier pricing before checkout coupons", async () => {
    const memberPhone = "13600136068";

    const tierSeedOrder = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Silver Price Customer",
          phone: memberPhone
        },
        address: {
          receiverName: "Silver Price Customer",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 3
          }
        ]
      })
      .expect(201);

    const tierSeedPayment = await request(app.getHttpServer())
      .post("/api/payments/wechat")
      .send({
        orderNo: tierSeedOrder.body.orderNo,
        channel: "h5"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/wechat/notify")
      .send({
        paymentNo: tierSeedPayment.body.paymentNo,
        providerTradeNo: "wx_member_tier_price_seed",
        paidAmountCents: tierSeedPayment.body.amountCents
      })
      .expect(200);

    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        couponCode: "WELCOME20",
        customer: {
          name: "Silver Price Customer",
          phone: memberPhone
        },
        address: {
          receiverName: "Silver Price Customer",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 2"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          memberTier: "silver",
          memberDiscountCents: 200,
          couponCode: "WELCOME20",
          discountCents: 2000,
          subtotalCents: 3990,
          totalCents: 1790
        });
      });
  });

  it("rejects checkout for an empty cart", async () => {
    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        customer: {
          name: "Demo Customer",
          phone: "13800138000"
        },
        address: {
          receiverName: "Demo Customer",
          phone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Cart is empty");
      });
  });

  it("creates a custom cloud pet and returns its dedicated homepage profile", async () => {
    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Validation Owner"))
      .send({
        ownerName: "   ",
        ownerPhone: "13800138000",
        name: "Blank Guard Pet",
        species: "cat",
        personality: "valid personality"
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Demo Owner"))
      .send({
        ownerName: "Demo Owner",
        ownerPhone: "13800138000",
        name: "   ",
        species: "cat",
        personality: "valid personality"
      })
      .expect(400);

    const maxPersonality = "p".repeat(80);

    const createResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("  13800138000  ", "  Demo Owner  "))
      .send({
        ownerName: "  Demo Owner  ",
        ownerPhone: "  13800138000  ",
        name: "  Dashboard Pet  ",
        species: "cat",
        personality: `  ${maxPersonality}  `
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      ownerName: "Demo Owner",
      ownerPhone: "13800138000",
      name: "Dashboard Pet",
        species: "cat",
        personality: maxPersonality,
      stats: {
        mood: 72,
        energy: 68,
        intimacy: 15
      },
      timeline: [
        expect.objectContaining({
          type: "adoption",
          title: "Dashboard Pet来到云养宠之家",
        })
      ]
    });
    expect(createResponse.body.petNo).toMatch(/^VP\d{14}\d{4}$/);

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${createResponse.body.petNo}`)
       .expect(200)
       .expect(({ body }) => {
         expect(body).toMatchObject({
           petNo: createResponse.body.petNo,
           name: "Dashboard Pet",
           species: "cat",
           bio: "Dashboard Pet是一只性格" + maxPersonality + "的云养猫咪。"
         });
         expect(body).not.toHaveProperty("ownerName");
         expect(body).not.toHaveProperty("ownerPhone");
         expect(body.bio).not.toContain("Demo Owner");
       });
   });

  it("returns pet-aware product recommendations for a cloud pet", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Demo Owner"))
      .send({
        ownerName: "Demo Owner",
        ownerPhone: "13800138000",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/recommendations`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            slug: "cat-teaser-wand",
            petType: "cat",
            reason: expect.stringContaining("猫咪互动需求")
          })
        ]);
      });
  });

  it("returns a member profile connecting pets, orders, community, and recommendations", async () => {
    const memberPhone = "13988776655";

    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Member Owner"))
      .send({
        ownerName: "Member Owner",
        ownerPhone: memberPhone,
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly",
      })
      .expect(201);

    const memberProfileCommunitySession = await loginAsMember(memberPhone, "Member Owner");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", memberProfileCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Member Owner",
        body: "Today the retention kitten completed the first community interaction.",
      })
      .expect(201);

    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "CTW-BASIC",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        customer: {
          name: "Member Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Member Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        }
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/members/${memberPhone}`)
      .set("X-Member-Token", memberProfileCommunitySession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.member).toMatchObject({
          phone: memberPhone,
          name: "Member Owner",
          tier: expect.any(String)
        });
        expect(body.pets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              name: "Dashboard Pet"
            })
          ])
        );
        expect(body.orders).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              totalCents: 2990
            })
          ])
        );
        expect(body.communityPosts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo
            })
          ])
        );
        expect(body.recommendations).toEqual([
          expect.objectContaining({
            slug: "cat-teaser-wand"
          })
        ]);
        expect(body.loyalty).toMatchObject({
          summary: {
            lifetimePoints: 49,
            availablePoints: 49,
            tier: "bronze",
            nextTier: "silver",
            pointsToNextTier: 51
          },
          ledger: expect.arrayContaining([
            expect.objectContaining({
              eventType: "order_purchase",
              points: 29
            }),
            expect.objectContaining({
              eventType: "community_post",
              points: 5
            }),
            expect.objectContaining({
              eventType: "pet_bond",
              points: 15
            })
          ]),
          rules: expect.arrayContaining([
            expect.objectContaining({
              eventType: "growth_task"
            })
          ])
        });
        expect(body.commercePlan).toMatchObject({
          tierProgress: {
            currentTier: expect.any(String),
            progressPercent: expect.any(Number)
          },
          benefits: expect.arrayContaining([
            expect.objectContaining({
              key: "welcome-gift",
              href: "/shop",
              unlocked: true
            })
          ]),
          nextBestActions: expect.any(Array)
        });
      });
  });

  it("lets a member save a default address and returns it in the profile", async () => {
    const phone = "13600137955";
    const memberSession = await loginAsMember(phone, "Address Member");

    await request(app.getHttpServer())
      .post("/api/members/me/addresses")
      .set("X-Member-Token", memberSession)
      .send({
        receiverName: "Address Member",
        phone,
        province: "Guangdong",
        city: "Shenzhen",
        district: "Nanshan",
        detail: "Cloud Pet Avenue 9",
        isDefault: true
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.addressNo).toMatch(/^ADDR\d{14}/);
        expect(body).toMatchObject({
          receiverName: "Address Member",
          phone,
          isDefault: true
        });
      });

    await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", memberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.addresses).toEqual([
          expect.objectContaining({
            receiverName: "Address Member",
            city: "Shenzhen",
            detail: "Cloud Pet Avenue 9",
            isDefault: true
          })
        ]);
        expect(body.defaultAddress).toMatchObject({
          receiverName: "Address Member",
          phone
        });
      });
  });

  it("lets a member redeem points for a checkout coupon", async () => {
    const memberPhone = "13900139777";
    const memberSession = await loginAsMember(memberPhone, "Points Owner");

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Points Owner"))
      .send({
        ownerName: "Points Owner",
        ownerPhone: memberPhone,
        name: "Points Pet",
        species: "dog",
        personality: "earns rewards from care and shopping"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Points Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Points Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Reward Road 8"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 2
          }
        ]
      })
      .expect(201);

    const beforeProfile = await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", memberSession)
      .expect(200);

    expect(beforeProfile.body.loyalty.redemptionRewards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "points-coupon-8",
          pointsCost: 80,
          couponCode: "POINTS8"
        })
      ])
    );
    expect(beforeProfile.body.loyalty.summary.availablePoints).toBeGreaterThanOrEqual(
      80
    );

    await request(app.getHttpServer())
      .post("/api/members/me/points/redemptions")
      .set("X-Member-Token", memberSession)
      .send({ rewardKey: "points-coupon-8" })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          rewardKey: "points-coupon-8",
          couponCode: "POINTS8",
          pointsCost: 80,
          discountCents: 800,
          status: "issued"
        });
        expect(body.redemptionNo).toMatch(/^LPR\d{14}\d{4}$/);
        expect(body.remainingPoints).toBe(
          beforeProfile.body.loyalty.summary.availablePoints - 80
        );
      });

    await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", memberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.loyalty.summary.availablePoints).toBe(
          beforeProfile.body.loyalty.summary.availablePoints - 80
        );
        expect(body.loyalty.redemptions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              rewardKey: "points-coupon-8",
              couponCode: "POINTS8"
            })
          ])
        );
      });

    const otherCartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${otherCartResponse.body.cartId}/checkout`)
      .send({
        couponCode: "POINTS8",
        customer: {
          name: "Other Owner",
          phone: "13900139778"
        },
        address: {
          receiverName: "Other Owner",
          phone: "13900139778",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Other Road 9"
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Coupon is not issued to this member");
      });

    const cartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${cartResponse.body.cartId}/checkout`)
      .send({
        couponCode: "POINTS8",
        customer: {
          name: "Points Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Points Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Reward Road 8"
        }
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          couponCode: "POINTS8",
          discountCents: 800,
          subtotalCents: 3990,
          totalCents: 3190
        });
      });

    const usedCartResponse = await request(app.getHttpServer())
      .post("/api/cart/items")
      .send({
        skuCode: "DBR-GREEN-M",
        quantity: 1
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cart/${usedCartResponse.body.cartId}/checkout`)
      .send({
        couponCode: "POINTS8",
        customer: {
          name: "Points Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Points Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Reward Road 8"
        }
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Coupon has already been used");
      });
  });

  it("returns advanced personalized recommendations from pets, commerce, community, and CMS", async () => {
    const memberPhone = "13988770088";
    await request(app.getHttpServer())
      .post("/api/admin/cms/blocks")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        slotKey: "homepage.personalized",
        title: "Daily care task and mall bundle",
        body: "Recommend matching tasks and products from today's Naigai and Niangao growth rhythm.",
        href: "/shop",
        ctaLabel: "选购推荐玩具",
        status: "published",
        sortOrder: 1
      })
      .expect(201);

    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Personalized Owner"))
      .send({
        ownerName: "Personalized Owner",
        ownerPhone: memberPhone,
        name: "Personalized Buddy",
        species: "dog",
        personality: "Likes tug play and community sharing",
      })
      .expect(201);

    const personalizedCommunitySession = await loginAsMember(memberPhone, "Personalized Owner");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", personalizedCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Personalized Owner",
        body: "Recommended puppy completed a tug training task today.",
      })
      .expect(201);

    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Personalized Owner",
          phone: memberPhone
        },
        address: {
          receiverName: "Personalized Owner",
          phone: memberPhone,
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const personalizedMemberSession = await loginAsMember(memberPhone, "Personalized Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", personalizedMemberSession)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "member_personalization",
        visitorId: "member_personalization_20260723"
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/members/${memberPhone}`)
      .set("X-Member-Token", personalizedMemberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.personalizedRecommendations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "product",
              targetId: "durable-bite-rope",
              actionHref: "/shop",
              reasonCodes: expect.arrayContaining([
                "pet_profile_match",
                "homepage_share_heat"
              ])
            }),
            expect.objectContaining({
              type: "growth_task",
              targetId: expect.any(String),
              actionHref: "/member",
              reasonCodes: expect.arrayContaining(["retention_next_step"])
            }),
            expect.objectContaining({
              type: "content",
              targetId: expect.stringMatching(/^CMS/),
              actionHref: "/shop",
              reasonCodes: expect.arrayContaining(["cms_campaign"])
            })
          ])
        );
        expect(body.personalizedRecommendations[0].score).toBeGreaterThanOrEqual(
          body.personalizedRecommendations.at(-1).score
        );
        expect(body.personalizationSummary).toMatchObject({
          petCount: 1,
          orderCount: expect.any(Number),
          communitySignalCount: expect.any(Number),
          homepageVisitCount: expect.any(Number),
          cmsSignalCount: expect.any(Number)
        });
        expect(body.personalizationSummary.homepageVisitCount).toBeGreaterThanOrEqual(1);
        expect(body.orders).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              orderNo: orderResponse.body.orderNo
            })
          ])
        );
      });
  });

  it("requires an active member session and binds cloud-pet ownership to it", async () => {
    const memberSession = await loginAsMember("13600136009", "Session Bound Owner");

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .send({
        ownerName: "Anonymous Owner",
        ownerPhone: "13600136008",
        name: "Anonymous Pet",
        species: "cat",
        personality: "Must not be created without a member session"
      })
      .expect(401);

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", memberSession)
      .send({
        ownerName: "Forged Owner",
        ownerPhone: "13600136010",
        name: "Session Bound Pet",
        species: "cat",
        personality: "Belongs to the authenticated member session"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          ownerName: "Session Bound Owner",
          ownerPhone: "13600136009",
          name: "Session Bound Pet"
        });
      });

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", "member_invalid")
      .send({
        ownerName: "Invalid Owner",
        ownerPhone: "13600136011",
        name: "Invalid Session Pet",
        species: "dog",
        personality: "Should not be created with an invalid session"
      })
      .expect(401);
  });

  it("rate limits cloud-pet creation per member session", async () => {
    const sessionToken = await loginAsMember(
      "13600136031",
      "Creation Limit Member"
    );

    for (let index = 1; index <= 5; index += 1) {
      await request(app.getHttpServer())
        .post("/api/cloud-pets")
        .set("X-Member-Token", sessionToken)
        .send({
          ownerName: "Creation Limit Member",
          ownerPhone: "13600136031",
          name: `Limit Pet ${index}`,
          species: index % 2 === 0 ? "dog" : "cat",
          personality: "Verifies the authenticated creation allowance"
        })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", sessionToken)
      .send({
        ownerName: "Creation Limit Member",
        ownerPhone: "13600136031",
        name: "Limit Pet 6",
        species: "cat",
        personality: "Must be blocked after the creation allowance"
      })
      .expect(429)
      .expect(({ body }) => {
        expect(body.message).toBe("操作过于频繁，请稍后再试。");
      });
  });

  it("logs in a member and returns the current member profile from the session", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13600136000", "Session Owner"))
      .send({
        ownerName: "Session Owner",
        ownerPhone: "13600136000",
        name: "Session Pet",
        species: "dog",
        personality: "Checks in every day"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/auth/verification-codes")
      .send({
        name: "   ",
        phone: "13600136000"
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Member name cannot be blank");
      });

    const maxMemberName = "m".repeat(40);

    const challengeResponse = await request(app.getHttpServer())
      .post("/api/auth/verification-codes")
      .send({
        name: `  ${maxMemberName}  `,
        phone: "  13600136000  "
      })
      .expect(201);

    expect(challengeResponse.body).toMatchObject({
      challengeId: expect.stringMatching(/^verify_/),
      developmentCode: expect.stringMatching(/^\d{6}$/)
    });

    await request(app.getHttpServer())
      .post("/api/auth/verification-codes")
      .send({
        name: maxMemberName,
        phone: "13600136000"
      })
      .expect(429)
      .expect(({ body }) => {
        expect(body.message).toBe("验证码发送过于频繁，请稍后再试。");
      });

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        challengeId: challengeResponse.body.challengeId,
        code:
          challengeResponse.body.developmentCode === "000000"
            ? "000001"
            : "000000"
      })
      .expect(401);

    const loginResponse = await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        challengeId: challengeResponse.body.challengeId,
        code: challengeResponse.body.developmentCode
      })
      .expect(201);

    expect(loginResponse.body).toMatchObject({
      member: {
        name: maxMemberName,
        phone: "13600136000"
      }
    });
    expect(loginResponse.body.sessionToken).toMatch(/^member_/);

    await request(app.getHttpServer())
      .post("/api/auth/login")
      .send({
        challengeId: challengeResponse.body.challengeId,
        code: challengeResponse.body.developmentCode
      })
      .expect(401);

    await request(app.getHttpServer()).get("/api/members/me").expect(401);

    await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", loginResponse.body.sessionToken)
      .expect(200)
      .expect(({ body }) => {
        expect(body.member).toMatchObject({
          name: "Session Owner",
          phone: "13600136000"
        });
        expect(body.pets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              name: "Session Pet"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .post("/api/auth/logout")
      .set("X-Member-Token", loginResponse.body.sessionToken)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({ success: true });
      });

    await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", loginResponse.body.sessionToken)
      .expect(401);
  });

  it("protects member profile, address, and point routes by session ownership", async () => {
    const ownerPhone = "13600136021";
    const ownerSession = await loginAsMember(ownerPhone, "Protected Member");
    const otherSession = await loginAsMember(
      "13600136022",
      "Other Protected Member"
    );
    const address = {
      receiverName: "Protected Member",
      phone: ownerPhone,
      province: "Guangdong",
      city: "Shenzhen",
      district: "Nanshan",
      detail: "Session Road 21",
      isDefault: true
    };

    await request(app.getHttpServer())
      .get(`/api/members/${ownerPhone}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/members/${ownerPhone}`)
      .set("X-Member-Token", otherSession)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/members/${ownerPhone}`)
      .set("X-Member-Token", ownerSession)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/members/${ownerPhone}/addresses`)
      .send(address)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/members/${ownerPhone}/addresses`)
      .set("X-Member-Token", otherSession)
      .send(address)
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/members/me/addresses")
      .send(address)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/api/members/${ownerPhone}/points/redemptions`)
      .set("X-Member-Token", otherSession)
      .send({ rewardKey: "points-coupon-8" })
      .expect(403);
    await request(app.getHttpServer())
      .post("/api/members/me/points/redemptions")
      .send({ rewardKey: "points-coupon-8" })
      .expect(401);
  });

  it("completes a cloud pet growth task and updates member retention signals", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139000", "Task Owner"))
      .send({
        ownerName: "Task Owner",
        ownerPhone: "13900139000",
        name: "Task Buddy",
        species: "dog",
        personality: "Wants to interact with the owner every day",
      })
      .expect(201);

    const taskMemberSession = await loginAsMember("13900139000", "Task Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", taskMemberSession)
      .expect(201)
      .expect(({ body }) => {
        expect(body.completedTask).toMatchObject({
          key: "daily-care",
          points: 20
        });
        expect(body.nextActions).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: "open-homepage",
              href: `/cloud-pets/${petResponse.body.petNo}`
            }),
            expect.objectContaining({
              key: "share-community",
              href: "/cloud-pets#community"
            }),
            expect.objectContaining({
              key: "shop-reward",
              href: "/shop"
            })
          ])
        );
        expect(body.pet.stats).toMatchObject({
          mood: 80,
          energy: 72,
          intimacy: 25
        });
        expect(body.pet.timeline).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "care_daily_diary",
              title: expect.stringContaining("成长日记"),
              body: expect.stringContaining("WELCOME20")
            })
          ])
        );
        expect(body.pet.timeline).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              type: "growth_task",
              title: "完成“日常照护”"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/members/13900139000")
      .set("X-Member-Token", taskMemberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.member.points).toBeGreaterThanOrEqual(25);
        expect(body.growthTasks).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              key: "daily-care",
              title: "日常照护"
            })
          ])
        );
        expect(body.taskActivity).toMatchObject({
          totalCompletedTasks: 1,
          activeDays: 1,
          currentStreakDays: 1,
          calendar: expect.arrayContaining([
            expect.objectContaining({
              completedCount: 1,
              taskKeys: ["daily-care"]
            })
          ])
        });
      });

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", taskMemberSession)
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe("Growth task already completed today");
      });
  });

  it("requires member auth before completing a cloud pet growth task", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139221", "Auth Guard"))
      .send({
        ownerName: "Auth Guard",
        ownerPhone: "13900139221",
        name: "Auth Buddy",
        species: "cat",
        personality: "Only grows with a valid member session"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });
  });
  it("rejects member-token growth task completion for another member's cloud pet", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139222", "Owner Guard"))
      .send({
        ownerName: "Owner Guard",
        ownerPhone: "13900139222",
        name: "Guard Buddy",
        species: "cat",
        personality: "Needs owner-bound daily care"
      })
      .expect(201);

    const otherMemberSession = await loginAsMember("13900139223", "Other Member");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", otherMemberSession)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Pet does not belong to current member");
      });
  });

  it("proves dual-member cloud-pet ownership isolation across private and public boundaries", async () => {
    const runId = Date.now().toString().slice(-8);
    const memberA = {
      name: `Isolation Member A ${runId}`,
      phone: `137${runId}`
    };
    const memberB = {
      name: `Isolation Member B ${runId}`,
      phone: `138${runId}`
    };
    const sessionA = await loginAsMember(memberA.phone, memberA.name);
    const sessionB = await loginAsMember(memberB.phone, memberB.name);

    expect(sessionA).not.toBe(sessionB);

    async function createPet(
      member: typeof memberA,
      sessionToken: string,
      name: string
    ) {
      const response = await request(app.getHttpServer())
        .post("/api/cloud-pets")
        .set("X-Member-Token", sessionToken)
        .send({
          ownerName: member.name,
          ownerPhone: member.phone,
          name,
          species: "cat",
          personality: "Verifies strict ownership boundaries between members"
        })
        .expect(201);

      return response.body as { petNo: string; timeline: Array<{ body: string }> };
    }

    const petA = await createPet(memberA, sessionA, `Isolation Pet A ${runId}`);
    const petB = await createPet(memberB, sessionB, `Isolation Pet B ${runId}`);

    expect(petA.petNo).not.toBe(petB.petNo);

    const memberAProfile = await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", sessionA)
      .expect(200);
    const memberBProfile = await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", sessionB)
      .expect(200);

    expect(memberAProfile.body.member).toMatchObject({
      name: memberA.name,
      phone: memberA.phone
    });
    expect(memberBProfile.body.member).toMatchObject({
      name: memberB.name,
      phone: memberB.phone
    });
    expect(memberAProfile.body.pets).toEqual(
      expect.arrayContaining([expect.objectContaining({ petNo: petA.petNo })])
    );
    expect(memberAProfile.body.pets).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ petNo: petB.petNo })])
    );
    expect(memberBProfile.body.pets).toEqual(
      expect.arrayContaining([expect.objectContaining({ petNo: petB.petNo })])
    );
    expect(memberBProfile.body.pets).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ petNo: petA.petNo })])
    );

    const crossMemberBody = `Cross-member note must be rejected ${runId}`;
    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petB.petNo}/diary-notes`)
      .set("X-Member-Token", sessionA)
      .send({
        title: "Rejected cross-member note",
        body: crossMemberBody
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Pet does not belong to current member");
      });

    const memberBAfterRejectedWrite = await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", sessionB)
      .expect(200);
    expect(memberBAfterRejectedWrite.body.pets[0].timeline).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ body: crossMemberBody })])
    );

    const ownMemberBody = `Member B own note ${runId}`;
    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petB.petNo}/diary-notes`)
      .set("X-Member-Token", sessionB)
      .send({
        title: "Member B own note",
        body: ownMemberBody
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.timeline).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "owner_note", body: ownMemberBody })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petA.petNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.petNo).toBe(petA.petNo);
        expect(body).not.toHaveProperty("ownerName");
        expect(body).not.toHaveProperty("ownerPhone");
      });
  });

  it("returns cloud-pet growth level, progress, and care state", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139111", "Growth Owner"))
      .send({
        ownerName: "Growth Owner",
        ownerPhone: "13900139111",
        name: "Growth Buddy",
        species: "dog",
        personality: "Enjoys building habits and collecting growth rewards",
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.growth).toMatchObject({
          level: 1,
          careState: "needs_care",
          todayCompletedTaskCount: 0,
          nextLevelExperience: expect.any(Number),
          progressPercent: expect.any(Number)
        });
      });

    const growthMemberSession = await loginAsMember("13900139111", "Growth Owner");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", growthMemberSession)
      .expect(201)
      .expect(({ body }) => {
        expect(body.pet.growth).toMatchObject({
          level: 2,
          careState: "thriving",
          todayCompletedTaskCount: 1
        });
        expect(body.pet.growth.experiencePoints).toBeGreaterThanOrEqual(40);
      });
  });

  it("updates a cloud-pet dedicated homepage builder profile", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139991", "Homepage Owner"))
      .send({
        ownerName: "Homepage Owner",
        ownerPhone: "13900139991",
        name: "Builder Pet",
        species: "dog",
        personality: "keeps a public growth archive"
      })
      .expect(201);

    const homepageMemberSession = await loginAsMember("13900139991", "Homepage Owner");

    const maxHomepageHeadline = "h".repeat(80);
    const maxHomepageStory = "s".repeat(240);

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .set("X-Member-Token", homepageMemberSession)
      .send({ headline: "   " })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .set("X-Member-Token", homepageMemberSession)
      .send({ ownerStory: "   " })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .set("X-Member-Token", homepageMemberSession)
      .send({
        theme: "forest",
        headline: `  ${maxHomepageHeadline}  `,
        ownerStory: `  ${maxHomepageStory}  `,
        showGrowthArchive: false,
        showMallRecommendations: true
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.homepage).toMatchObject({
          theme: "forest",
          headline: maxHomepageHeadline,
          ownerStory: maxHomepageStory,
          showGrowthArchive: false,
          showMallRecommendations: true
        });
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.homepage).toMatchObject({
          theme: "forest",
          headline: maxHomepageHeadline,
          ownerStory: maxHomepageStory,
          showGrowthArchive: false,
          showMallRecommendations: true
        });
      });
  });

  it("requires the owning member session before updating a cloud-pet homepage", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139990", "Homepage Guard"))
      .send({
        ownerName: "Homepage Guard",
        ownerPhone: "13900139990",
        name: "Guard Homepage Pet",
        species: "cat",
        personality: "Only the owner may edit the homepage"
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .send({ headline: "Unauthorized edit" })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });

    const otherMemberSession = await loginAsMember("13900139989", "Other Homepage Member");

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .set("X-Member-Token", otherMemberSession)
      .send({ headline: "Wrong owner edit" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Pet does not belong to current member");
      });
  });
  it("limits owner diary notes per pet each day", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139995", "Diary Limit Owner"))
      .send({
        ownerName: "Diary Limit Owner",
        ownerPhone: "13900139995",
        name: "Diary Limit Pet",
        species: "dog",
        personality: "needs owner note rate limiting"
      })
      .expect(201);

    const ownerSession = await loginAsMember("13900139995", "Diary Limit Owner");

    for (let index = 1; index <= 5; index += 1) {
      await request(app.getHttpServer())
        .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
        .set("X-Member-Token", ownerSession)
        .send({ body: `Owner note ${index} for daily limit verification.` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "Owner note 6 should be blocked by the daily limit." })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe("Daily owner diary note limit reached");
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=owner_note`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(5);
        expect(body.filters).toEqual(
          expect.arrayContaining([expect.objectContaining({ key: "owner_note", count: 5 })])
        );
      });

  });
  it("lets the owning member update and delete cloud-pet diary notes", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139994", "Diary Note Owner"))
      .send({
        ownerName: "Diary Note Owner",
        ownerPhone: "13900139994",
        name: "Note Pet",
        species: "cat",
        personality: "keeps editable owner notes"
      })
      .expect(201);

    const ownerSession = await loginAsMember("13900139994", "Diary Note Owner");
    const otherSession = await loginAsMember("13900139995", "Other Diary Member");
    const maxDiaryNoteTitle = "t".repeat(80);
    const maxDiaryNoteBody = "b".repeat(500);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "   " })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Diary note body is required");
      });

    const noteResponse = await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", ownerSession)
      .send({ title: `  ${maxDiaryNoteTitle}  `, body: `  ${maxDiaryNoteBody}  ` })
      .expect(201);
    const noteId = noteResponse.body.timeline[0].id;

    expect(noteId).toEqual(expect.any(String));
    expect(noteResponse.body.timeline[0]).toMatchObject({
      id: noteId,
      type: "owner_note",
      title: maxDiaryNoteTitle,
      body: maxDiaryNoteBody
    });

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", otherSession)
      .send({ body: "Wrong owner edit." })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "   " })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe("Diary note body is required");
      });

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "  Owner note after editing.  " })
      .expect(200)
      .expect(({ body }) => {
        expect(body.timeline[0]).toMatchObject({
          id: noteId,
          type: "owner_note",
          body: "Owner note after editing."
        });
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=owner_note`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({ id: noteId, body: "Owner note after editing." })
        ]);
      });

    await request(app.getHttpServer())
      .delete(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", otherSession)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.timeline).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: noteId })])
        );
      });

    await request(app.getHttpServer())
      .delete(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes/${noteId}`)
      .set("X-Member-Token", ownerSession)
      .expect(404);
  });
  it("returns a shareable cloud-pet homepage archive with filters", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139992", "Archive Owner"))
      .send({
        ownerName: "Archive Owner",
        ownerPhone: "13900139992",
        name: "Archive Pet",
        species: "dog",
        personality: "turns growth moments into a shareable story"
      })
      .expect(201);

    const archiveMemberSession = await loginAsMember("13900139992", "Archive Owner");

    await request(app.getHttpServer())
      .patch(`/api/cloud-pets/${petResponse.body.petNo}/homepage`)
      .set("X-Member-Token", archiveMemberSession)
      .send({
        theme: "midnight",
        headline: "Archive Pet's growth archive",
        ownerStory: "A public timeline for daily care and memories.",
        showGrowthArchive: true,
        showMallRecommendations: true
      })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", archiveMemberSession)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .send({ body: "Unauthorized diary note" })
      .expect(401);

    const otherArchiveSession = await loginAsMember("13900139993", "Other Archive Member");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", otherArchiveSession)
      .send({ body: "Wrong owner diary note" })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/diary-notes`)
      .set("X-Member-Token", archiveMemberSession)
      .send({ body: "Owner noticed a calmer care rhythm today." })
      .expect(201)
      .expect(({ body }) => {
        expect(body.timeline[0]).toMatchObject({
          type: "owner_note",
          body: "Owner noticed a calmer care rhythm today."
        });
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=growth_task`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          petNo: petResponse.body.petNo,
          share: {
            title: "Archive Pet's growth archive",
            ctaLabel: "打开宠物主页"
          },
          commerceReward: {
            status: "unlocked",
            couponCode: "WELCOME20",
            discountCents: 2000,
            ctaHref: "/shop",
            recommendedProductSlug: expect.any(String)
          }
        });
        expect(body.share.url).toBe(`/cloud-pets/${petResponse.body.petNo}`);
        expect(body.filters).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ key: "all", count: 4 }),
            expect.objectContaining({ key: "growth_task", count: 1 }),
            expect.objectContaining({ key: "daily_diary", count: 1 }),
            expect.objectContaining({ key: "owner_note", count: 1 })
          ])
        );
        expect(body.items).toEqual([
          expect.objectContaining({
            type: "growth_task",
            title: expect.any(String)
          })
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=daily_diary`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            type: "daily_diary",
            title: expect.stringContaining("成长日记"),
            body: expect.stringContaining("WELCOME20")
          })
        ]);
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive?eventType=owner_note`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            type: "owner_note",
            body: "Owner noticed a calmer care rhythm today."
          })
        ]);
      });
  });

  it("records cloud-pet homepage visits back into archive and admin metrics", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139993", "Visit Owner"))
      .send({
        ownerName: "Visit Owner",
        ownerPhone: "13900139993",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "  share_link  ",
        visitorId: "visitor_202607230001"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          petNo: petResponse.body.petNo,
          source: "share_link",
          visitCount: 1
        });
      });

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "share_link",
        visitorId: "visitor_202607230001"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          source: "share_link",
          visitCount: 1
        });
      });

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "share_link",
        visitorId: "visitor_202607230002"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.visitCount).toBe(2);
      });

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "homepage_refresh",
        visitorId: "visitor_202607230001"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.visitCount).toBe(3);
      });

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({
        source: "invalid source should be rejected",
        visitorId: "visitor_202607230001"
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${petResponse.body.petNo}/homepage/visits`)
      .send({ source: "share_link" })
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${petResponse.body.petNo}/homepage/archive`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.engagement).toMatchObject({
          homepageVisitCount: 3
        });
      });

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              homepageVisitCount: 3
            })
          ])
        );
      });
  });

  it("lets admin generate missing daily cloud-pet diaries idempotently", async () => {
    const caredPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139994", "Diary Owner A"))
      .send({
        ownerName: "Diary Owner A",
        ownerPhone: "13900139994",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    const missingPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139995", "Diary Owner B"))
      .send({
        ownerName: "Diary Owner B",
        ownerPhone: "13900139995",
        name: "Diary Pet B",
        species: "dog",
        personality: "needs today's generated diary"
      })
      .expect(201);

    const caredMemberSession = await loginAsMember("13900139994", "Diary Owner A");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${caredPetResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", caredMemberSession)
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets/daily-diaries/status")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.totalPetCount).toBeGreaterThanOrEqual(2);
        expect(body.missingTodayCount).toBeGreaterThanOrEqual(1);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: caredPetResponse.body.petNo,
              status: "covered"
            }),
            expect.objectContaining({
              petNo: missingPetResponse.body.petNo,
              status: "missing"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/pets/daily-diary-coverage")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.coveredCount).toBeGreaterThanOrEqual(1);
        expect(body.missingCount).toBeGreaterThanOrEqual(1);
        expect(body.coverageRate).toBeLessThan(1);
        expect(body.missingPets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petId: missingPetResponse.body.petNo,
              petNo: missingPetResponse.body.petNo,
              petName: "Diary Pet B",
              memberId: "13900139995",
              memberPhone: "13900139995",
              reason: "NO_TASK_COMPLETED"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .post("/api/admin/cloud-pets/daily-diaries/generate")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(201)
      .expect(({ body }) => {
        expect(body.generatedCount).toBeGreaterThanOrEqual(1);
        expect(body.skippedCount).toBeGreaterThanOrEqual(1);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: caredPetResponse.body.petNo,
              status: "skipped"
            }),
            expect.objectContaining({
              petNo: missingPetResponse.body.petNo,
              status: "generated",
              event: expect.objectContaining({
                type: "care_daily_diary",
                title: expect.stringContaining("成长日记")
              })
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .post("/api/admin/cloud-pets/daily-diaries/generate")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(201)
      .expect(({ body }) => {
        expect(body.generatedCount).toBe(0);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: missingPetResponse.body.petNo,
              status: "skipped"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/cloud-pets/daily-diaries/status")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.missingTodayCount).toBe(0);
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: missingPetResponse.body.petNo,
              status: "covered"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/cloud-pets/${missingPetResponse.body.petNo}/homepage/archive?eventType=daily_diary`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            type: "daily_diary",
            body: expect.stringContaining("WELCOME20")
          })
        ]);
      });

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              action: "cloud_pets.daily_diary.generate",
              targetType: "cloud_pet_daily_diary"
            })
          ])
        );
      });
  });

  it("backfills missing daily cloud-pet diaries with selected and missing-only modes", async () => {
    const selectedMemberSession = await loginAsMember(
      "13900139984",
      "Backfill Owner A"
    );
    const selectedPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", selectedMemberSession)
      .send({
        ownerName: "Backfill Owner A",
        ownerPhone: "13900139984",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    const remainingPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139985", "Backfill Owner B"))
      .send({
        ownerName: "Backfill Owner B",
        ownerPhone: "13900139985",
        name: "Backfill Pet B",
        species: "dog",
        personality: "should remain missing until missingOnly runs"
      })
      .expect(201);

    const coveredPetResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900139986", "Backfill Owner C"))
      .send({
        ownerName: "Backfill Owner C",
        ownerPhone: "13900139986",
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    const coveredMemberSession = await loginAsMember("13900139986", "Backfill Owner C");

    await request(app.getHttpServer())
      .post(`/api/cloud-pets/${coveredPetResponse.body.petNo}/growth-tasks/daily-care/complete`)
      .set("X-Member-Token", coveredMemberSession)
      .expect(201);

    const ownerSession = await loginAsAdmin("owner");

    await request(app.getHttpServer())
      .post("/api/admin/pets/daily-diary-coverage/backfill")
      .set("X-Admin-Session", ownerSession)
      .send({
        date: new Date().toISOString().slice(0, 10),
        mode: "selected",
        petIds: [
          selectedPetResponse.body.petNo,
          coveredPetResponse.body.petNo,
          "VP_MISSING_TEST"
        ]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.mode).toBe("selected");
        expect(body.attemptedCount).toBe(3);
        expect(body.successCount).toBe(1);
        expect(body.skippedCount).toBe(2);
        expect(body.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petId: selectedPetResponse.body.petNo,
              petNo: selectedPetResponse.body.petNo,
              status: "created",
              reason: "NO_TASK_COMPLETED"
            }),
            expect.objectContaining({
              petId: coveredPetResponse.body.petNo,
              status: "skipped",
              reason: "ALREADY_HAS_DIARY"
            }),
            expect.objectContaining({
              petId: "VP_MISSING_TEST",
              status: "skipped",
              reason: "PET_NOT_FOUND"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/members/me")
      .set("X-Member-Token", selectedMemberSession)
      .expect(200)
      .expect(({ body }) => {
        const selectedPet = body.pets.find(
          (pet: { petNo: string }) => pet.petNo === selectedPetResponse.body.petNo
        );
        expect(selectedPet.timeline).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "presence_daily_diary" })
          ])
        );
        expect(selectedPet.growth.todayCompletedTaskCount).toBe(0);
        expect(selectedPet.growth.isCareCompleteToday).toBe(false);
      });

    await request(app.getHttpServer())
      .post("/api/admin/pets/daily-diary-coverage/backfill")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        date: new Date().toISOString().slice(0, 10),
        mode: "selected",
        petIds: [selectedPetResponse.body.petNo]
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.successCount).toBe(0);
        expect(body.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petId: selectedPetResponse.body.petNo,
              status: "skipped",
              reason: "ALREADY_HAS_DIARY"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/pets/daily-diary-coverage")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.missingPets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petId: remainingPetResponse.body.petNo
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .post("/api/admin/pets/daily-diary-coverage/backfill")
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        date: new Date().toISOString().slice(0, 10),
        mode: "missingOnly"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.mode).toBe("missingOnly");
        expect(body.successCount).toBeGreaterThanOrEqual(1);
        expect(body.results).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petId: remainingPetResponse.body.petNo,
              status: "created",
              reason: "NO_TASK_COMPLETED"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/pets/daily-diary-coverage")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.missingCount).toBe(0);
        expect(body.coverageRate).toBe(1);
      });

    await request(app.getHttpServer())
      .get("/api/admin/operation-logs")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              staffNo: "STAFF_OWNER",
              staffName: "Owner Admin",
              role: "owner",
              action: "cloud_pets.daily_diary.backfill",
              targetType: "cloud_pet_daily_diary_coverage"
            })
          ])
        );
      });
  });

  it("requires the owning member session before creating a community post", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900136770", "Community Guard"))
      .send({
        ownerName: "Community Guard",
        ownerPhone: "13900136770",
        name: "Guard Community Pet",
        species: "cat",
        personality: "Only the owner can post in its voice"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .send({
        petNo: petResponse.body.petNo,
        body: "Anonymous post should fail."
      })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });

    const otherMemberSession = await loginAsMember("13900136771", "Other Community Member");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", otherMemberSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "Wrong owner post should fail."
      })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Pet does not belong to current member");
      });
  });
  it("lets only the owning member withdraw a community post without hiding admin evidence", async () => {
    const ownerPhone = "13900136773";
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(ownerPhone, "Community Withdraw Owner"))
      .send({
        ownerName: "Community Withdraw Owner",
        ownerPhone,
        name: "Withdraw Pet",
        species: "cat",
        personality: "can withdraw an accidental community update"
      })
      .expect(201);
    const ownerSession = await loginAsMember(ownerPhone, "Community Withdraw Owner");
    const otherSession = await loginAsMember("13900136774", "Other Community Member");

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "This community update can be withdrawn by its owner."
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", otherSession)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Only the post author can withdraw this post");
      });

    await request(app.getHttpServer())
      .delete(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(401);

    const withdrawnResponse = await request(app.getHttpServer())
      .delete(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", ownerSession)
      .expect(200);

    expect(withdrawnResponse.body).toMatchObject({
      postNo: postResponse.body.postNo,
      authorDeletedAt: expect.any(String)
    });

    await request(app.getHttpServer())
      .delete(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.authorDeletedAt).toBe(withdrawnResponse.body.authorDeletedAt);
      });

    await request(app.getHttpServer())
      .get("/api/community/posts")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).not.toEqual(
          expect.arrayContaining([
            expect.objectContaining({ postNo: postResponse.body.postNo })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(404);

    await request(app.getHttpServer())
      .get("/api/admin/community/posts")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              postNo: postResponse.body.postNo,
              authorDeletedAt: withdrawnResponse.body.authorDeletedAt
            })
          ])
        );
      });
  });

  it("returns visible community post details but blocks hidden posts", async () => {
    const ownerPhone = "13900136775";
    const ownerSession = await loginAsMember(ownerPhone, "Community Detail Owner");
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", ownerSession)
      .send({
        ownerName: "Community Detail Owner",
        ownerPhone,
        name: "Detail Pet",
        species: "dog",
        personality: "has a stable discussion page"
      })
      .expect(201);
    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "A community post with a stable detail page."
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "The discussion survives a reload." })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          postNo: postResponse.body.postNo,
          body: "A community post with a stable detail page.",
          commentCount: 1
        });
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/community/posts/${postResponse.body.postNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({ status: "hidden" })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .expect(404);
  });

  it("lets only the comment author withdraw a community comment", async () => {
    const ownerPhone = "13900136776";
    const ownerSession = await loginAsMember(ownerPhone, "Comment Withdraw Owner");
    const otherSession = await loginAsMember("13900136777", "Other Comment Member");
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", ownerSession)
      .send({
        ownerName: "Comment Withdraw Owner",
        ownerPhone,
        name: "Comment Pet",
        species: "cat",
        personality: "keeps comment ownership explicit"
      })
      .expect(201);
    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "A post with a comment that can be withdrawn."
      })
      .expect(201);
    const commentResponse = await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "This comment belongs to the owner." })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/community/comments/${commentResponse.body.commentNo}`)
      .set("X-Member-Token", otherSession)
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Only the comment author can withdraw this comment");
      });

    await request(app.getHttpServer())
      .delete(`/api/community/comments/${commentResponse.body.commentNo}`)
      .expect(401);

    const withdrawnResponse = await request(app.getHttpServer())
      .delete(`/api/community/comments/${commentResponse.body.commentNo}`)
      .set("X-Member-Token", ownerSession)
      .expect(200);
    expect(withdrawnResponse.body).toMatchObject({
      commentNo: commentResponse.body.commentNo,
      authorDeletedAt: expect.any(String)
    });

    await request(app.getHttpServer())
      .delete(`/api/community/comments/${commentResponse.body.commentNo}`)
      .set("X-Member-Token", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.authorDeletedAt).toBe(withdrawnResponse.body.authorDeletedAt);
      });

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([]);
      });
    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.commentCount).toBe(0);
      });
  });

  it("lets only the owning member edit a visible community post", async () => {
    const ownerPhone = "13900139801";
    const otherPhone = "13900139802";
    const ownerSession = await loginAsMember(ownerPhone, "Post Editor");
    const otherSession = await loginAsMember(otherPhone, "Other Editor");

    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", ownerSession)
      .send({
        ownerName: "Post Editor",
        ownerPhone,
        name: "Editable Community Pet",
        species: "cat",
        personality: "Can edit a community post"
      })
      .expect(201);

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "Original community post body"
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", otherSession)
      .send({ body: "Other member edit" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.message).toBe("Only the post author can edit this post");
      });

    await request(app.getHttpServer())
      .patch(`/api/community/posts/${postResponse.body.postNo}`)
      .send({ body: "Anonymous edit" })
      .expect(401);

    const updatedResponse = await request(app.getHttpServer())
      .patch(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "Updated community post body" })
      .expect(200);

    expect(updatedResponse.body).toMatchObject({
      postNo: postResponse.body.postNo,
      body: "Updated community post body",
      status: "visible"
    });

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.body).toBe("Updated community post body");
      });

    await request(app.getHttpServer())
      .delete(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", ownerSession)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/community/posts/${postResponse.body.postNo}`)
      .set("X-Member-Token", ownerSession)
      .send({ body: "Restore attempt" })
      .expect(404);
  });

  it("requires member auth before community interactions", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13900136772", "Community Auth Owner"))
      .send({
        ownerName: "Community Auth Owner",
        ownerPhone: "13900136772",
        name: "Community Auth Pet",
        species: "dog",
        personality: "keeps interaction permissions honest"
      })
      .expect(201);

    const communitySession = await loginAsMember("13900136772", "Community Auth Owner");

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", communitySession)
      .send({
        petNo: petResponse.body.petNo,
        body: "This post exists so anonymous interactions can be rejected."
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/likes`)
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .send({ body: "Anonymous comment should fail." })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });

    await request(app.getHttpServer())
      .post(`/api/community/pets/${petResponse.body.petNo}/follows`)
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .send({ reason: "Anonymous report should fail." })
      .expect(401)
      .expect(({ body }) => {
        expect(body.message).toBe("Invalid member session");
      });
  });

  it("creates and lists community posts from a cloud pet", async () => {
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember("13800138000", "Demo Owner"))
      .send({
        ownerName: "Demo Owner",
        ownerPhone: "13800138000",
        name: "Nian Gao",
        species: "dog",
        personality: "Warm, clingy, and always wants friends",
      })
      .expect(201);

    const demoCommunitySession = await loginAsMember("13800138000", "Demo Owner");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", demoCommunitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Demo Owner",
        body: "Today Nian Gao brought the toy next to Naigai for the first time and wagged happily.",
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          petNo: petResponse.body.petNo,
          petName: "Nian Gao",
          authorName: "Demo Owner",
          body: expect.stringContaining("toy")
        });
        expect(body.commerceBridge).toMatchObject({
          ctaHref: "/shop",
          ctaLabel: "选购推荐玩具",
          recommendedProduct: expect.objectContaining({
            slug: "durable-bite-rope",
            petType: "dog"
          })
        });
        expect(body.commerceBridge.reason).toEqual(
          expect.stringContaining(body.petName)
        );
        expect(body.postNo).toMatch(/^POST\d{14}\d{4}$/);
      });

    await request(app.getHttpServer())
      .get("/api/community/posts")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              petName: "Nian Gao",
            })
          ])
        );
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              petNo: petResponse.body.petNo,
              commerceBridge: expect.objectContaining({
                ctaHref: "/shop",
                ctaLabel: "选购推荐玩具",
                recommendedProduct: expect.objectContaining({
                  slug: "durable-bite-rope",
                  petType: "dog"
                })
              })
            })
          ])
        );
      });
  });

  it("rejects oversized community comments and report reasons", async () => {
    const memberPhone = "13600136789";
    const maxCommunityPostBody = "p".repeat(280);
    const maxCommunityCommentBody = "c".repeat(280);
    const maxCommunityReportReason = "r".repeat(160);

    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Community Limit Owner"))
      .send({
        ownerName: "Community Limit Owner",
        ownerPhone: memberPhone,
        name: "Community Limit Pet",
        species: "dog",
        personality: "keeps community input bounded"
      })
      .expect(201);

    const communitySession = await loginAsMember(memberPhone, "Community Limit Owner");

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", communitySession)
      .send({
        petNo: petResponse.body.petNo,
        body: "p".repeat(281)
      })
      .expect(400);

    await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", communitySession)
      .send({
        petNo: petResponse.body.petNo,
        body: "   "
      })
      .expect(400);

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", communitySession)
      .send({
        petNo: petResponse.body.petNo,
        body: `  ${maxCommunityPostBody}  `
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.body).toBe(maxCommunityPostBody);
      });

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", communitySession)
      .send({ body: "c".repeat(281) })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", communitySession)
      .send({ body: "   " })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", communitySession)
      .send({ body: `  ${maxCommunityCommentBody}  ` })
      .expect(201)
      .expect(({ body }) => {
        expect(body.body).toBe(maxCommunityCommentBody);
      });

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", communitySession)
      .send({ reason: "r".repeat(161) })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", communitySession)
      .send({ reason: "   " })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", communitySession)
      .send({ reason: `  ${maxCommunityReportReason}  ` })
      .expect(201)
      .expect(({ body }) => {
        expect(body.reason).toBe(maxCommunityReportReason);
      });
  });

  it("rate limits community writes per member session", async () => {
    const ownerPhone = "13600136786";
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(ownerPhone, "Rate Limit Owner"))
      .send({
        ownerName: "Rate Limit Owner",
        ownerPhone,
        name: "Rate Limit Pet",
        species: "cat",
        personality: "keeps community traffic within a healthy rhythm"
      })
      .expect(201);

    const ownerSession = await loginAsMember(ownerPhone, "Rate Limit Owner");
    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", ownerSession)
      .send({
        petNo: petResponse.body.petNo,
        body: "A dedicated post for verifying community write limits."
      })
      .expect(201);

    for (let index = 0; index < 10; index += 1) {
      await request(app.getHttpServer())
        .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
        .set("X-Member-Token", ownerSession)
        .send({ reason: `Rate limit verification ${index + 1}` })
        .expect(201);
    }

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", ownerSession)
      .send({ reason: "This request should be rate limited" })
      .expect(429)
      .expect("Retry-After", /\d+/)
      .expect(({ body }) => {
        expect(body.message).toBe("操作过于频繁，请稍后再试。");
      });

    const otherSession = await loginAsMember("13600136785", "Other Rate Limit Member");

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", otherSession)
      .send({ reason: "A separate member still has an independent allowance" })
      .expect(201);
  });

  it("supports community likes, comments, follows, reports, and admin report handling", async () => {
    const memberPhone = "13600136788";
    const petResponse = await request(app.getHttpServer())
      .post("/api/cloud-pets")
      .set("X-Member-Token", await loginAsMember(memberPhone, "Community Owner"))
      .send({
        ownerName: "Community Owner",
        ownerPhone: memberPhone,
        name: "Dashboard Pet",
        species: "cat",
        personality: "spots dashboard signals quickly"
      })
      .expect(201);

    const communitySession = await loginAsMember(memberPhone, "Community Owner");

    const postResponse = await request(app.getHttpServer())
      .post("/api/community/posts")
      .set("X-Member-Token", communitySession)
      .send({
        petNo: petResponse.body.petNo,
        authorName: "Community Owner",
        body: "Interactive kitten made its first community business post today.",
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/likes`)
      .set("X-Member-Token", communitySession)
      .send({
        memberPhone,
        authorName: "Community Owner"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          postNo: postResponse.body.postNo,
          liked: true,
          likeCount: 1
        });
      });
    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/likes`)
      .set("X-Member-Token", communitySession)
      .send({
        memberPhone,
        authorName: "Community Owner"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          postNo: postResponse.body.postNo,
          liked: true,
          likeCount: 1
        });
      });

    await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .set("X-Member-Token", communitySession)
      .send({
        authorName: "Community Owner",
        memberPhone,
        body: "This update can settle into real community engagement.",
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          postNo: postResponse.body.postNo,
          authorName: "Community Owner",
          body: "This update can settle into real community engagement.",
          status: "visible"
        });
      });

    await request(app.getHttpServer())
      .get(`/api/community/posts/${postResponse.body.postNo}/comments`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            postNo: postResponse.body.postNo,
            authorName: "Community Owner",
            body: "This update can settle into real community engagement."
          })
        ]);
      });

    await request(app.getHttpServer())
      .post(`/api/community/pets/${petResponse.body.petNo}/follows`)
      .set("X-Member-Token", communitySession)
      .send({
        followerPhone: memberPhone,
        followerName: "Community Owner"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          petNo: petResponse.body.petNo,
          followerPhone: memberPhone,
          following: true,
          created: true,
          followerCount: 1
        });
      });
    await request(app.getHttpServer())
      .post(`/api/community/pets/${petResponse.body.petNo}/follows`)
      .set("X-Member-Token", communitySession)
      .send({
        followerPhone: memberPhone,
        followerName: "Community Owner"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          petNo: petResponse.body.petNo,
          followerPhone: memberPhone,
          following: true,
          created: false,
          followerCount: 1
        });
      });

    await request(app.getHttpServer())
      .get("/api/community/posts/following")
      .set("X-Member-Token", communitySession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual([
          expect.objectContaining({
            postNo: postResponse.body.postNo,
            petNo: petResponse.body.petNo
          })
        ]);
      });

    const reportReason = "Selected report reason for merchant review.";

    const reportResponse = await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", communitySession)
      .send({
        reporterName: "Community Owner",
        memberPhone,
        reason: reportReason
      })
      .expect(201);

    expect(reportResponse.body).toMatchObject({
      postNo: postResponse.body.postNo,
      status: "pending_review",
      reason: reportReason,
      created: true
    });

    const duplicateReportResponse = await request(app.getHttpServer())
      .post(`/api/community/posts/${postResponse.body.postNo}/reports`)
      .set("X-Member-Token", communitySession)
      .send({
        reporterName: "Community Owner",
        memberPhone,
        reason: "Repeated report should reuse the pending report."
      })
      .expect(201);

    expect(duplicateReportResponse.body).toMatchObject({
      reportNo: reportResponse.body.reportNo,
      postNo: postResponse.body.postNo,
      status: "pending_review",
      created: false
    });

    await request(app.getHttpServer())
      .get("/api/community/posts")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              postNo: postResponse.body.postNo,
              likeCount: 1,
              commentCount: 1,
              reportCount: 1
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get("/api/admin/community/reports")
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              reportNo: reportResponse.body.reportNo,
              status: "pending_review",
              reporterName: "Community Owner",
              memberPhone,
              reason: reportReason
            })
          ])
        );
        const reportsForPost = body.items.filter(
          (item: { postNo: string }) => item.postNo === postResponse.body.postNo
        );
        expect(reportsForPost).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .get(
        `/api/admin/community/reports?status=pending_review&postNo=${postResponse.body.postNo}&memberPhone=${memberPhone}`
      )
      .set("X-Admin-Token", "dev-admin-key")
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({
          reportNo: reportResponse.body.reportNo,
          postNo: postResponse.body.postNo,
          memberPhone,
          status: "pending_review"
        });
      });

    await request(app.getHttpServer())
      .patch(`/api/admin/community/reports/${reportResponse.body.reportNo}/status`)
      .set("X-Admin-Token", "dev-admin-key")
      .send({
        status: "dismissed",
        note: "No violation in smoke test"
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          reportNo: reportResponse.body.reportNo,
          status: "dismissed",
          note: "No violation in smoke test"
        });
      });

    await request(app.getHttpServer())
      .get(`/api/members/${memberPhone}`)
      .set("X-Member-Token", communitySession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.communityEngagement).toMatchObject({
          likedPostCount: 1,
          commentCount: 1,
          followingPetCount: 1,
          reportCount: 1
        });
      });
  });

  it("requires member auth for payment intents and keeps payment confirmation idempotent", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Intent Customer",
          phone: "13600136222"
        },
        address: {
          receiverName: "Intent Customer",
          phone: "13600136222",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Intent Street 2"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    await request(app.getHttpServer())
      .post("/api/payments/intents")
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_wechat"
      })
      .expect(401);

    const memberSession = await loginAsMember("13600136222", "Intent Customer");

    const paymentIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", memberSession)
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_wechat"
      })
      .expect(201);

    expect(paymentIntent.body).toMatchObject({
      orderId: orderResponse.body.orderNo,
      amount: 3990,
      provider: "mock_wechat",
      status: "pending"
    });

    await request(app.getHttpServer())
      .post(`/api/payments/${paymentIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.orderStatus).toBe("paid");
        expect(body.paymentIntent.status).toBe("paid");
      });

    await request(app.getHttpServer())
      .post(`/api/payments/${paymentIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.orderStatus).toBe("paid");
        expect(body.paymentIntent.status).toBe("paid");
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("paid");
      });
  });

  it("exposes payment ledger to owner admin and rejects operator access", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Ledger Customer",
          phone: "13600136223"
        },
        address: {
          receiverName: "Ledger Customer",
          phone: "13600136223",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Ledger Street 3"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const memberSession = await loginAsMember("13600136223", "Ledger Customer");
    const paymentIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", memberSession)
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_alipay"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/payments/${paymentIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(201);

    await request(app.getHttpServer())
      .get("/api/admin/payments")
      .expect(401);

    const ownerSession = await loginAsAdmin("owner");
    await request(app.getHttpServer())
      .get("/api/admin/payments?orderId=" + orderResponse.body.orderNo)
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: paymentIntent.body.id,
              orderId: orderResponse.body.orderNo,
              provider: "mock_alipay",
              status: "paid"
            })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/admin/payments/${paymentIntent.body.id}`)
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentIntent).toMatchObject({
          id: paymentIntent.body.id,
          orderId: orderResponse.body.orderNo,
          status: "paid"
        });
        expect(
          body.ledger.filter((entry: { eventType: string }) => entry.eventType === "payment_confirmed")
        ).toHaveLength(1);
      });

    const operatorSession = await loginAsAdmin("operator");
    await request(app.getHttpServer())
      .get("/api/admin/payments")
      .set("X-Admin-Session", operatorSession)
      .expect(403);
  });

  it("lets a member cancel an unpaid order and exposes the cancelled payment to admin", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Cancel Customer",
          phone: "13600136226"
        },
        address: {
          receiverName: "Cancel Customer",
          phone: "13600136226",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Cancel Street 6"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const memberSession = await loginAsMember("13600136226", "Cancel Customer");
    const paymentIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", memberSession)
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_wechat"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/orders/${orderResponse.body.orderNo}/cancel`)
      .set("X-Member-Token", memberSession)
      .send({
        reason: "CHANGED_MIND",
        note: "Need a different variant"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderId: orderResponse.body.orderNo,
          orderStatus: "cancelled",
          closeReason: "MEMBER_CANCELLED",
          memberCancelReason: "CHANGED_MIND",
          memberCancelNote: "Need a different variant",
          inventoryReleased: true,
          paymentIntent: {
            id: paymentIntent.body.id,
            status: "cancelled"
          }
        });
      });

    await request(app.getHttpServer())
      .post(`/api/orders/${orderResponse.body.orderNo}/cancel`)
      .set("X-Member-Token", memberSession)
      .send({
        reason: "CHANGED_MIND"
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.orderStatus).toBe("cancelled");
        expect(body.inventoryReleased).toBe(true);
      });

    await request(app.getHttpServer())
      .post(`/api/payments/${paymentIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe("Payment intent has been cancelled");
      });

    await request(app.getHttpServer())
      .get(`/api/payments/${paymentIntent.body.id}`)
      .set("X-Member-Token", memberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: paymentIntent.body.id,
          status: "cancelled",
          orderStatus: "cancelled",
          orderCloseReason: "MEMBER_CANCELLED",
          orderMemberCancelReason: "CHANGED_MIND",
          orderMemberCancelNote: "Need a different variant"
        });
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          orderNo: orderResponse.body.orderNo,
          status: "cancelled",
          closeReason: "MEMBER_CANCELLED",
          memberCancelReason: "CHANGED_MIND",
          memberCancelNote: "Need a different variant"
        });
      });

    const ownerSession = await loginAsAdmin("owner");
    await request(app.getHttpServer())
      .get(`/api/admin/payments/${paymentIntent.body.id}`)
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentIntent).toMatchObject({
          id: paymentIntent.body.id,
          orderId: orderResponse.body.orderNo,
          status: "cancelled",
          orderCloseReason: "MEMBER_CANCELLED",
          orderMemberCancelReason: "CHANGED_MIND",
          orderMemberCancelNote: "Need a different variant"
        });
        expect(
          body.ledger.filter((entry: { eventType: string }) => entry.eventType === "payment_cancelled")
        ).toHaveLength(1);
      });
  });
  it("expires a user payment intent and prevents late confirmation", async () => {
    const previousTimeout = process.env.PAYMENT_TIMEOUT_MINUTES;
    process.env.PAYMENT_TIMEOUT_MINUTES = "0.0001";

    try {
      const orderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .send({
          customer: {
            name: "Expired Customer",
            phone: "13600136224"
          },
          address: {
            receiverName: "Expired Customer",
            phone: "13600136224",
            province: "Guangdong",
            city: "Shenzhen",
            district: "Nanshan",
            detail: "Expired Street 4"
          },
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 1
            }
          ]
        })
        .expect(201);

      const memberSession = await loginAsMember("13600136224", "Expired Customer");
      const paymentIntent = await request(app.getHttpServer())
        .post("/api/payments/intents")
        .set("X-Member-Token", memberSession)
        .send({
          orderId: orderResponse.body.orderNo,
          provider: "mock_wechat"
        })
        .expect(201);

      expect(paymentIntent.body.expiresAt).toBeDefined();
      await new Promise((resolve) => setTimeout(resolve, 40));

      await request(app.getHttpServer())
        .post(`/api/payments/${paymentIntent.body.id}/confirm`)
        .set("X-Member-Token", memberSession)
        .send({ result: "success" })
        .expect(409)
        .expect(({ body }) => {
          expect(body.message).toBe("Payment intent has expired");
        });

      await request(app.getHttpServer())
        .get(`/api/payments/${paymentIntent.body.id}`)
        .set("X-Member-Token", memberSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe("expired");
          expect(body.orderStatus).toBe("cancelled");
          expect(body.orderCloseReason).toBe("PAYMENT_TIMEOUT");
        });

      await request(app.getHttpServer())
        .get(`/api/orders/${orderResponse.body.orderNo}`)
        .expect(200)
        .expect(({ body }) => {
          expect(body.status).toBe("cancelled");
          expect(body.closeReason).toBe("PAYMENT_TIMEOUT");
        });
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.PAYMENT_TIMEOUT_MINUTES;
      } else {
        process.env.PAYMENT_TIMEOUT_MINUTES = previousTimeout;
      }
    }
  });

  it("lets owner admin scan overdue payment intents", async () => {
    const previousTimeout = process.env.PAYMENT_TIMEOUT_MINUTES;
    process.env.PAYMENT_TIMEOUT_MINUTES = "0.0001";

    try {
      const orderResponse = await request(app.getHttpServer())
        .post("/api/orders")
        .send({
          customer: {
            name: "Overdue Admin Customer",
            phone: "13600136225"
          },
          address: {
            receiverName: "Overdue Admin Customer",
            phone: "13600136225",
            province: "Guangdong",
            city: "Shenzhen",
            district: "Nanshan",
            detail: "Overdue Street 5"
          },
          items: [
            {
              skuCode: "DBR-GREEN-M",
              quantity: 1
            }
          ]
        })
        .expect(201);

      const memberSession = await loginAsMember("13600136225", "Overdue Admin Customer");
      const paymentIntent = await request(app.getHttpServer())
        .post("/api/payments/intents")
        .set("X-Member-Token", memberSession)
        .send({
          orderId: orderResponse.body.orderNo,
          provider: "mock_alipay"
        })
        .expect(201);

      await new Promise((resolve) => setTimeout(resolve, 40));
      const ownerSession = await loginAsAdmin("owner");

      await request(app.getHttpServer())
        .post("/api/admin/payments/expire-overdue")
        .set("X-Admin-Session", ownerSession)
        .send({ limit: 10 })
        .expect(201)
        .expect(({ body }) => {
          expect(body.expiredIntentCount).toBeGreaterThanOrEqual(1);
          expect(body.closedOrderCount).toBeGreaterThanOrEqual(1);
          expect(body.inventoryReleasedCount).toBeGreaterThanOrEqual(1);
          expect(body.results).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                paymentIntentId: paymentIntent.body.id,
                status: "expired"
              })
            ])
          );
        });

      await request(app.getHttpServer())
        .get(`/api/admin/payments/${paymentIntent.body.id}`)
        .set("X-Admin-Session", ownerSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.paymentIntent).toMatchObject({
            id: paymentIntent.body.id,
            orderId: orderResponse.body.orderNo,
            orderCloseReason: "PAYMENT_TIMEOUT",
            status: "expired"
          });
          expect(
            body.ledger.filter((entry: { eventType: string }) => entry.eventType === "payment_expired")
          ).toHaveLength(1);
        });

      await request(app.getHttpServer())
        .get("/api/admin/operation-logs")
        .set("X-Admin-Session", ownerSession)
        .expect(200)
        .expect(({ body }) => {
          expect(body.items).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                action: "payments.expire_overdue",
                staffName: "Owner Admin"
              })
            ])
          );
        });
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.PAYMENT_TIMEOUT_MINUTES;
      } else {
        process.env.PAYMENT_TIMEOUT_MINUTES = previousTimeout;
      }
    }
  });
  it("lets a member retry after payment failure and exposes the attempt chain to admin", async () => {
    const orderResponse = await request(app.getHttpServer())
      .post("/api/orders")
      .send({
        customer: {
          name: "Retry Customer",
          phone: "13600136227"
        },
        address: {
          receiverName: "Retry Customer",
          phone: "13600136227",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Retry Street 7"
        },
        items: [
          {
            skuCode: "DBR-GREEN-M",
            quantity: 1
          }
        ]
      })
      .expect(201);

    const memberSession = await loginAsMember("13600136227", "Retry Customer");
    const firstIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", memberSession)
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_alipay"
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/payments/${firstIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "failed" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.paymentIntent).toMatchObject({
          id: firstIntent.body.id,
          status: "failed",
          failureCode: "INSUFFICIENT_BALANCE",
          attemptNo: 1
        });
        expect(body.orderStatus).toBe("pending_payment");
      });

    await request(app.getHttpServer())
      .post(`/api/payments/${firstIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(409)
      .expect(({ body }) => {
        expect(body.message).toBe("Payment intent has failed. Create a new payment attempt."
        );
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}/payment-attempts`)
      .set("X-Member-Token", memberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.attempts).toEqual([
          expect.objectContaining({
            paymentIntentId: firstIntent.body.id,
            attemptNo: 1,
            status: "failed"
          })
        ]);
      });

    const secondIntent = await request(app.getHttpServer())
      .post("/api/payments/intents")
      .set("X-Member-Token", memberSession)
      .send({
        orderId: orderResponse.body.orderNo,
        provider: "mock_wechat"
      })
      .expect(201);

    expect(secondIntent.body.id).not.toBe(firstIntent.body.id);
    expect(secondIntent.body.attemptNo).toBe(2);
    expect(secondIntent.body.previousPaymentIntentId).toBe(firstIntent.body.id);

    await request(app.getHttpServer())
      .post(`/api/payments/${secondIntent.body.id}/confirm`)
      .set("X-Member-Token", memberSession)
      .send({ result: "success" })
      .expect(201)
      .expect(({ body }) => {
        expect(body.paymentIntent).toMatchObject({
          id: secondIntent.body.id,
          status: "paid",
          attemptNo: 2
        });
        expect(body.orderStatus).toBe("paid");
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe("paid");
      });

    await request(app.getHttpServer())
      .get(`/api/orders/${orderResponse.body.orderNo}/payment-attempts`)
      .set("X-Member-Token", memberSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.attempts).toEqual([
          expect.objectContaining({ paymentIntentId: firstIntent.body.id, attemptNo: 1, status: "failed" }),
          expect.objectContaining({ paymentIntentId: secondIntent.body.id, attemptNo: 2, status: "paid" })
        ]);
      });

    const ownerSession = await loginAsAdmin("owner");
    await request(app.getHttpServer())
      .get("/api/admin/payments?status=failed&failureCode=INSUFFICIENT_BALANCE")
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.items).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ id: firstIntent.body.id, failureCode: "INSUFFICIENT_BALANCE" })
          ])
        );
      });

    await request(app.getHttpServer())
      .get(`/api/admin/payments/${secondIntent.body.id}`)
      .set("X-Admin-Session", ownerSession)
      .expect(200)
      .expect(({ body }) => {
        expect(body.paymentIntent).toMatchObject({
          id: secondIntent.body.id,
          previousPaymentIntentId: firstIntent.body.id,
          attemptNo: 2,
          status: "paid"
        });
        expect(body.relatedIntents).toEqual([
          expect.objectContaining({ id: firstIntent.body.id, attemptNo: 1, status: "failed" }),
          expect.objectContaining({ id: secondIntent.body.id, attemptNo: 2, status: "paid" })
        ]);
      });
  });
});






