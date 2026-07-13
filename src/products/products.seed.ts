import { ProductDetail } from "./product.types";

export const starterProducts: ProductDetail[] = [
  {
    id: "prod_durable_bite_rope",
    slug: "durable-bite-rope",
    title: "Durable bite rope",
    description: "A washable cotton rope toy for daily tug and chew play.",
    petType: "dog",
    toyType: "chew",
    tags: ["daily-care", "tug-play", "washable"],
    priceCents: 3990,
    coverImageUrl: "/brand/naigai-niangao/duo-toy-play.png",
    images: [
      "/brand/naigai-niangao/duo-toy-play.png",
      "/brand/naigai-niangao/niangao-toy.png"
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
    tags: ["feather", "hunting", "indoor-play"],
    priceCents: 2990,
    coverImageUrl: "/brand/naigai-niangao/naigai-observing.png",
    images: [
      "/brand/naigai-niangao/naigai-observing.png",
      "/brand/naigai-niangao/naigai-standard.png"
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
