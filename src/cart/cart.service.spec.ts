import { ConfigService } from "@nestjs/config";
import { OrdersService } from "../orders/orders.service";
import { ProductsService } from "../products/products.service";
import { CartService } from "./cart.service";

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === "DATABASE_URL" ? databaseUrl : undefined
    )
  } as unknown as ConfigService;
}

function createProductsService(): ProductsService {
  return {
    findVariantBySkuCode: jest.fn().mockResolvedValue({
      product: {
        title: "Durable bite rope"
      },
      variant: {
        id: "var_dbr_green_m",
        skuCode: "DBR-GREEN-M",
        priceCents: 3990,
        stock: 50,
        isAvailable: true
      }
    })
  } as unknown as ProductsService;
}

describe("CartService", () => {
  it("keeps the in-memory cart fallback when no database is configured", async () => {
    const service = new CartService(
      createProductsService(),
      {} as OrdersService,
      createConfigService(),
      {} as never
    );

    await expect(
      service.addItem({ skuCode: "DBR-GREEN-M", quantity: 2 })
    ).resolves.toMatchObject({
      subtotalCents: 7980,
      items: [
        {
          skuCode: "DBR-GREEN-M",
          quantity: 2,
          lineTotalCents: 7980
        }
      ]
    });
  });

  it("persists a database cart item and returns a usable cart response", async () => {
    let prisma: any;
    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) =>
        callback(prisma)
      ),
      cart: {
        create: jest
          .fn()
          .mockResolvedValue({ id: "cart_internal_1", cartNo: "cart_db_1" }),
        findUnique: jest.fn().mockResolvedValue({
          cartNo: "cart_db_1",
          items: [
            {
              quantity: 2,
              variant: {
                skuCode: "DBR-GREEN-M",
                priceCents: 3990,
                product: { title: "Durable bite rope" }
              }
            }
          ]
        })
      },
      cartItem: {
        upsert: jest.fn().mockResolvedValue({})
      }
    };
    const service = new CartService(
      createProductsService(),
      {} as OrdersService,
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never
    );

    await expect(
      service.addItem({ skuCode: "DBR-GREEN-M", quantity: 2 })
    ).resolves.toEqual({
      cartId: "cart_db_1",
      subtotalCents: 7980,
      items: [
        {
          skuCode: "DBR-GREEN-M",
          title: "Durable bite rope",
          quantity: 2,
          unitPriceCents: 3990,
          lineTotalCents: 7980
        }
      ]
    });
    expect(prisma.cart.create).toHaveBeenCalledWith({
      data: { cartNo: expect.stringMatching(/^cart_/) }
    });
    expect(prisma.cartItem.upsert).toHaveBeenCalledWith({
      where: {
        cartId_variantId: {
          cartId: "cart_internal_1",
          variantId: "var_dbr_green_m"
        }
      },
      update: {
        quantity: { increment: 2 }
      },
      create: {
        cartId: "cart_internal_1",
        variantId: "var_dbr_green_m",
        quantity: 2
      }
    });
  });
});
