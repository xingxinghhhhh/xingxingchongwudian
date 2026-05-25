import {
  ProductRecord,
  mapProductRecordToDetail,
  mapProductRecordToListItem
} from "./product.mapper";

const dbProduct: ProductRecord = {
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
