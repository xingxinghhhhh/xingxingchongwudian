# Catalog Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the product catalog from seed-only reads to Prisma-backed reads when a database is configured, while preserving the existing API contract and local fallback behavior.

**Architecture:** Add a focused product persistence boundary inside `src/products/`. `ProductsService` chooses between Prisma-backed catalog reads and seed fallback reads, then exposes async methods used by controllers, cart, orders, and admin. A seed script writes the current starter catalog into Prisma with stable slugs and SKU codes.

**Tech Stack:** NestJS 11, Prisma 6, TypeScript, Jest, Supertest.

---

## File Structure

- Create `src/products/product.mapper.ts`: maps Prisma-shaped product records into existing API response types.
- Create `src/products/product.mapper.spec.ts`: unit tests for mapping database product records.
- Modify `src/products/products.service.ts`: read from Prisma when `DATABASE_URL` is configured; otherwise use `starterProducts`.
- Create `src/products/products.service.spec.ts`: tests database-mode and seed-fallback service behavior.
- Modify `src/products/products.module.ts`: import `DatabaseModule` so `ProductsService` can receive `PrismaService`.
- Modify `src/products/products.controller.ts`: return async product service results.
- Modify `src/orders/orders.service.ts`: await async product lookup.
- Modify `src/orders/orders.controller.ts`: return async order service results.
- Modify `src/cart/cart.service.ts`: await async product and order service calls.
- Modify `src/cart/cart.controller.ts`: return async cart service results.
- Modify `src/admin/admin.controller.ts`: return async product and order service results.
- Modify `src/payments/payments.service.ts`: await async order service calls.
- Modify `src/payments/payments.controller.ts`: return async payment service results.
- Create `prisma/seed.ts`: idempotently upsert starter products, variants, and images.
- Modify `package.json`: add `prisma:seed` script.
- Modify `test/app.e2e-spec.ts`: keep route assertions unchanged; async behavior is covered through HTTP.

## Task 1: Product Mapper

**Files:**
- Create: `src/products/product.mapper.ts`
- Create: `src/products/product.mapper.spec.ts`

- [ ] **Step 1: Write the failing mapper test**

```ts
import { mapProductRecordToDetail, mapProductRecordToListItem } from "./product.mapper";

const dbProduct = {
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
      compareAtCents: 4990,
      stock: 7
    }
  ],
  images: [
    { id: "img_2", url: "/two.jpg", sortOrder: 2 },
    { id: "img_1", url: "/one.jpg", sortOrder: 1 }
  ]
};

describe("product mapper", () => {
  it("maps a Prisma product record to the public product detail shape", () => {
    expect(mapProductRecordToDetail(dbProduct)).toEqual({
      id: "prod_db",
      slug: "db-rope",
      title: "DB rope",
      description: "Database backed rope",
      petType: "dog",
      toyType: "chew",
      priceCents: 3990,
      coverImageUrl: "/one.jpg",
      images: ["/one.jpg", "/two.jpg"],
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
          compareAtCents: 4990,
          stock: 7,
          isAvailable: true
        }
      ]
    });
  });

  it("maps a Prisma product record to the list item shape", () => {
    expect(mapProductRecordToListItem(dbProduct)).toEqual({
      id: "prod_db",
      slug: "db-rope",
      title: "DB rope",
      petType: "dog",
      toyType: "chew",
      priceCents: 3990,
      coverImageUrl: "/one.jpg",
      status: "active"
    });
  });
});
```

- [ ] **Step 2: Run the mapper test to verify it fails**

Run: `& 'C:\Program Files\nodejs\npx.cmd' jest --runInBand src/products/product.mapper.spec.ts`

Expected: FAIL because `product.mapper.ts` does not exist.

- [ ] **Step 3: Implement the mapper**

```ts
import { PetType, ProductDetail, ProductListItem, ProductStatus } from "./product.types";

export interface ProductRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  petType: PetType;
  toyType: string;
  status: ProductStatus;
  variants: ProductVariantRecord[];
  images: ProductImageRecord[];
}

export interface ProductVariantRecord {
  id: string;
  skuCode: string;
  name: string;
  color: string | null;
  size: string | null;
  material: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
}

export interface ProductImageRecord {
  id: string;
  url: string;
  sortOrder: number;
}

export function mapProductRecordToDetail(record: ProductRecord): ProductDetail {
  const images = getSortedImageUrls(record);
  const variants = record.variants.map((variant) => ({
    id: variant.id,
    skuCode: variant.skuCode,
    name: variant.name,
    color: variant.color ?? "",
    size: variant.size ?? "",
    material: variant.material ?? "",
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents ?? undefined,
    stock: variant.stock,
    isAvailable: variant.stock > 0
  }));

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    petType: record.petType,
    toyType: record.toyType,
    priceCents: getLowestVariantPrice(variants),
    coverImageUrl: images[0] ?? "",
    images,
    status: record.status,
    variants
  };
}

export function mapProductRecordToListItem(record: ProductRecord): ProductListItem {
  const detail = mapProductRecordToDetail(record);
  const { description, images, variants, ...listItem } = detail;
  return listItem;
}

function getSortedImageUrls(record: ProductRecord): string[] {
  return [...record.images]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((image) => image.url);
}

function getLowestVariantPrice(variants: ProductDetail["variants"]): number {
  return variants.reduce(
    (lowest, variant) => Math.min(lowest, variant.priceCents),
    variants[0]?.priceCents ?? 0
  );
}
```

- [ ] **Step 4: Run the mapper test to verify it passes**

Run: `& 'C:\Program Files\nodejs\npx.cmd' jest --runInBand src/products/product.mapper.spec.ts`

Expected: PASS.

## Task 2: Products Service Persistence Boundary

**Files:**
- Modify: `src/products/products.service.ts`
- Create: `src/products/products.service.spec.ts`
- Modify: `src/products/products.module.ts`

- [ ] **Step 1: Write the failing service tests**

```ts
import { ConfigService } from "@nestjs/config";
import { ProductsService } from "./products.service";

function createConfigService(databaseUrl?: string) {
  return {
    get: jest.fn((key: string) => (key === "DATABASE_URL" ? databaseUrl : undefined))
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
```

- [ ] **Step 2: Run the service test to verify it fails**

Run: `& 'C:\Program Files\nodejs\npx.cmd' jest --runInBand src/products/products.service.spec.ts`

Expected: FAIL because the service constructor and methods are still synchronous seed-only code.

- [ ] **Step 3: Implement database-aware `ProductsService`**

Update `ProductsService` to inject `ConfigService` and `PrismaService`, make public methods async, use `prisma.product.findMany` / `findFirst` when configured, and keep existing seed behavior when not configured.

- [ ] **Step 4: Import `DatabaseModule` in `ProductsModule`**

`ProductsModule` must import `DatabaseModule` and continue exporting `ProductsService`.

- [ ] **Step 5: Run service tests to verify they pass**

Run: `& 'C:\Program Files\nodejs\npx.cmd' jest --runInBand src/products/products.service.spec.ts`

Expected: PASS.

## Task 3: Async Call Chain

**Files:**
- Modify: `src/products/products.controller.ts`
- Modify: `src/orders/orders.service.ts`
- Modify: `src/orders/orders.controller.ts`
- Modify: `src/cart/cart.service.ts`
- Modify: `src/cart/cart.controller.ts`
- Modify: `src/admin/admin.controller.ts`
- Modify: `src/payments/payments.service.ts`
- Modify: `src/payments/payments.controller.ts`

- [ ] **Step 1: Run e2e tests before implementation**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run test:e2e`

Expected after Task 2 implementation: FAIL if any caller still treats async product/order methods as synchronous values.

- [ ] **Step 2: Await product lookups in order and cart services**

Update order creation, cart response mapping, cart stock validation, and cart checkout to await async product and order operations.

- [ ] **Step 3: Await order operations in payment service**

Update payment creation and notification to await order reads and status updates.

- [ ] **Step 4: Let controllers return promises**

Update controller methods to return async service calls directly or mark methods `async` where composition requires it.

- [ ] **Step 5: Run e2e tests to verify route behavior is preserved**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run test:e2e`

Expected: PASS with 19 tests.

## Task 4: Database Seed Script

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json`

- [ ] **Step 1: Add a seed script**

Create `prisma/seed.ts` that imports `starterProducts`, connects with `PrismaClient`, upserts products by slug, deletes and recreates images for each product, and upserts variants by SKU code.

- [ ] **Step 2: Add package script**

Add `"prisma:seed": "set PATH=C:\\Program Files\\nodejs;%PATH%&& node_modules\\.bin\\ts-node.cmd prisma/seed.ts"` to `package.json`.

- [ ] **Step 3: Validate TypeScript build**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run build`

Expected: PASS.

## Task 5: Final Verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run: `& 'C:\Program Files\nodejs\npx.cmd' jest --runInBand src/products/product.mapper.spec.ts src/products/products.service.spec.ts`

Expected: PASS.

- [ ] **Step 2: Run e2e tests**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run test:e2e`

Expected: PASS with 19 tests.

- [ ] **Step 3: Validate Prisma schema**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run prisma:validate`

Expected: PASS.

- [ ] **Step 4: Run API build**

Run: `& 'C:\Program Files\nodejs\npm.cmd' run build`

Expected: PASS.
