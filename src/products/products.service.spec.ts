import { ConfigService } from "@nestjs/config";
import { ProductsService } from "./products.service";

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) =>
      key === "DATABASE_URL" ? databaseUrl : undefined
    )
  } as unknown as ConfigService;
}

describe("ProductsService", () => {
  it("uses starter products when no database is configured", async () => {
    const service = new ProductsService(createConfigService(), {} as never);

    await expect(service.listActiveProducts()).resolves.toEqual([
      expect.objectContaining({ slug: "durable-bite-rope" }),
      expect.objectContaining({ slug: "cat-teaser-wand" })
    ]);
  });

  it("uses Prisma products when a database is configured", async () => {
    const prisma = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "prod_db",
            slug: "db-rope",
            title: "DB rope",
            description: "Database backed rope",
            petType: "dog",
            toyType: "chew",
            status: "active",
            variants: [
              {
                id: "var_db",
                skuCode: "DB-ROPE",
                name: "Green / Medium",
                color: "green",
                size: "M",
                material: "cotton",
                priceCents: 3990,
                compareAtCents: null,
                stock: 7
              }
            ],
            images: [{ id: "img_db", url: "/db.jpg", sortOrder: 0 }]
          }
        ])
      }
    };
    const service = new ProductsService(
      createConfigService("mysql://user:pass@localhost:3306/shop"),
      prisma as never
    );

    await expect(service.listActiveProducts()).resolves.toEqual([
      expect.objectContaining({ slug: "db-rope", coverImageUrl: "/db.jpg" })
    ]);
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { status: "active" },
      include: {
        variants: true,
        images: { orderBy: { sortOrder: "asc" } }
      },
      orderBy: { createdAt: "asc" }
    });
  });
});
