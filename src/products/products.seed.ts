import { ProductDetail } from "./product.types";

export const starterProducts: ProductDetail[] = [
  {
    id: "prod_durable_bite_rope",
    slug: "durable-bite-rope",
    title: "Durable bite rope",
    description: "A washable cotton rope toy for daily tug and chew play.",
    petType: "dog",
    toyType: "chew",
    priceCents: 3990,
    coverImageUrl: "/images/products/durable-bite-rope.jpg",
    images: [
      "/images/products/durable-bite-rope.jpg",
      "/images/products/durable-bite-rope-play.jpg"
    ],
    status: "active",
    variants: [
      {
        id: "var_dbr_green_m",
        skuCode: "DBR-GREEN-M",
        name: "Green / Medium",
        color: "green",
        size: "M",
        material: "cotton rope",
        priceCents: 3990,
        compareAtCents: 4990,
        stock: 50,
        isAvailable: true
      }
    ]
  },
  {
    id: "prod_cat_teaser_wand",
    slug: "cat-teaser-wand",
    title: "Cat teaser wand set",
    description: "A light interactive wand set for indoor cat hunting play.",
    petType: "cat",
    toyType: "interactive",
    priceCents: 2990,
    coverImageUrl: "/images/products/cat-teaser-wand.jpg",
    images: [
      "/images/products/cat-teaser-wand.jpg",
      "/images/products/cat-teaser-wand-action.jpg"
    ],
    status: "active",
    variants: [
      {
        id: "var_ctw_basic",
        skuCode: "CTW-BASIC",
        name: "Basic set",
        color: "mixed",
        size: "standard",
        material: "feather and plastic",
        priceCents: 2990,
        stock: 80,
        isAvailable: true
      }
    ]
  }
];
