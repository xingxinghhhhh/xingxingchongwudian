import { ConfigService } from "@nestjs/config";
import { LoyaltyService } from "../loyalty/loyalty.service";
import { MarketingService } from "../marketing/marketing.service";
import { ProductsService } from "../products/products.service";
import { OrdersService } from "./orders.service";

const createOrderDto = {
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
};

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
    }),
    reserveInventory: jest.fn().mockResolvedValue(undefined),
    releaseInventory: jest.fn().mockResolvedValue(undefined)
  } as unknown as ProductsService;
}

function createMarketingService(): MarketingService {
  const resolveDiscount = async (
    couponCodes: Array<string | undefined> | undefined,
    subtotalCents: number
  ) => {
    const normalizedCouponCode = couponCodes
      ?.find((couponCode) => couponCode?.trim())
      ?.trim()
      .toUpperCase();

    if (normalizedCouponCode !== "WELCOME20") {
      return {
        discountCents: 0
      };
    }

    return {
      couponCode: normalizedCouponCode,
      discountCents: Math.min(2000, subtotalCents)
    };
  };

  return {
    resolveCoupon: jest.fn((couponCode: string | undefined, subtotalCents: number) =>
      resolveDiscount(couponCode ? [couponCode] : [], subtotalCents)
    ),
    resolveCoupons: jest.fn(resolveDiscount),
    markCouponUsed: jest.fn()
  } as unknown as MarketingService;
}

function createLoyaltyService(): LoyaltyService {
  return {
    getTier: jest.fn((points: number) => {
      if (points >= 300) {
        return "gold";
      }

      if (points >= 100) {
        return "silver";
      }

      return "bronze";
    })
  } as unknown as LoyaltyService;
}

describe("OrdersService", () => {
  it("keeps the seed fallback order behavior when no database is configured", async () => {
    const productsService = createProductsService();
    const service = new OrdersService(
      productsService,
      createConfigService(),
      {} as never,
      createLoyaltyService(),
      createMarketingService()
    );

    await expect(service.createOrder(createOrderDto)).resolves.toMatchObject({
      status: "pending_payment",
      totalCents: 7980,
      memberTier: "bronze",
      memberDiscountCents: 0,
      customer: createOrderDto.customer,
      address: createOrderDto.address,
      items: [
        {
          skuCode: "DBR-GREEN-M",
          quantity: 2,
          unitPriceCents: 3990
        }
      ]
    });
    expect(productsService.reserveInventory).toHaveBeenCalledWith([
      {
        skuCode: "DBR-GREEN-M",
        quantity: 2
      }
    ]);
  });

  it("persists a database order with customer and address snapshots", async () => {
    let prisma: any;
    prisma = {
      $transaction: jest.fn(async (callback: (client: any) => Promise<any>) =>
        callback(prisma)
      ),
      customer: {
        upsert: jest.fn().mockResolvedValue({ id: "cust_1" })
      },
      productVariant: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }) => ({
          orderNo: data.orderNo,
          status: data.status,
          totalCents: data.totalCents,
          subtotalCents: data.subtotalCents,
          discountCents: data.discountCents,
          couponCode: data.couponCode,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          province: data.province,
          city: data.city,
          district: data.district,
          detail: data.detail,
          items: data.items.create.map((item: any) => ({
            skuSnapshot: item.skuSnapshot,
            titleSnapshot: item.titleSnapshot,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents
          }))
        }))
      }
    };
    const service = new OrdersService(
      createProductsService(),
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never,
      createLoyaltyService(),
      createMarketingService()
    );

    await expect(service.createOrder(createOrderDto)).resolves.toMatchObject({
      status: "pending_payment",
      totalCents: 7980,
      memberTier: "bronze",
      memberDiscountCents: 0,
      customer: createOrderDto.customer,
      address: createOrderDto.address,
      items: [
        {
          skuCode: "DBR-GREEN-M",
          title: "Durable bite rope",
          quantity: 2,
          unitPriceCents: 3990
        }
      ]
    });
    expect(prisma.customer.upsert).toHaveBeenCalledWith({
      where: { phone: "13800138000" },
      update: { name: "Demo Customer" },
      create: { name: "Demo Customer", phone: "13800138000" }
    });
    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith({
      where: {
        id: "var_dbr_green_m",
        stock: { gte: 2 }
      },
      data: {
        stock: { decrement: 2 }
      }
    });
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "cust_1",
          customerName: "Demo Customer",
          customerPhone: "13800138000",
          receiverName: "Demo Customer",
          receiverPhone: "13800138000",
          province: "Guangdong",
          city: "Shenzhen",
          district: "Nanshan",
          detail: "Science Park 1",
          items: {
            create: [
              {
                variantId: "var_dbr_green_m",
                titleSnapshot: "Durable bite rope",
                skuSnapshot: "DBR-GREEN-M",
                unitPriceCents: 3990,
                quantity: 2
              }
            ]
          }
        })
      })
    );
  });
});
