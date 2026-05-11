import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { AppModule } from "../src/app.module";

describe("Pet toy shop API", () => {
  let app: INestApplication;

  beforeAll(async () => {
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
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          status: "ok",
          service: "pet-toy-shop-api",
          database: {
            orm: "prisma",
            provider: "mysql",
            configured: false
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
        expect(body.orderNo).toMatch(/^KZT\d{14}$/);
      });
  });

  it("returns an order by order number", async () => {
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

  it("rejects admin requests without an admin token", async () => {
    await request(app.getHttpServer()).get("/api/admin/products").expect(401);
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
                stock: 50
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
        expect(body.orderNo).toMatch(/^KZT\d{14}$/);
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
});
