import { Injectable, NotFoundException } from "@nestjs/common";
import { starterProducts } from "./products.seed";

@Injectable()
export class ProductsService {
  listAdminProducts() {
    return starterProducts;
  }

  listActiveProducts() {
    return starterProducts
      .filter((product) => product.status === "active")
      .map(({ variants, description, images, ...listItem }) => listItem);
  }

  getActiveProductBySlug(slug: string) {
    const product = starterProducts.find(
      (item) => item.slug === slug && item.status === "active"
    );

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  findVariantBySkuCode(skuCode: string) {
    for (const product of starterProducts) {
      const variant = product.variants.find((item) => item.skuCode === skuCode);
      if (variant && product.status === "active") {
        return {
          product,
          variant
        };
      }
    }

    return null;
  }
}
