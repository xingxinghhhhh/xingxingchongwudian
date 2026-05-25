import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import {
  ProductRecord,
  mapProductRecordToDetail,
  mapProductRecordToListItem
} from "./product.mapper";
import { starterProducts } from "./products.seed";

@Injectable()
export class ProductsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async listAdminProducts() {
    if (!this.isDatabaseConfigured()) {
      return starterProducts;
    }

    const products = await this.prisma.product.findMany({
      include: this.productInclude(),
      orderBy: { createdAt: "asc" }
    });

    return products.map((product) =>
      mapProductRecordToDetail(product as ProductRecord)
    );
  }

  async listActiveProducts() {
    if (!this.isDatabaseConfigured()) {
      return starterProducts
        .filter((product) => product.status === "active")
        .map(({ variants, description, images, ...listItem }) => listItem);
    }

    const products = await this.prisma.product.findMany({
      where: { status: "active" },
      include: this.productInclude(),
      orderBy: { createdAt: "asc" }
    });

    return products.map((product) =>
      mapProductRecordToListItem(product as ProductRecord)
    );
  }

  async getActiveProductBySlug(slug: string) {
    const product = this.isDatabaseConfigured()
      ? await this.findActiveDatabaseProductBySlug(slug)
      : starterProducts.find(
          (item) => item.slug === slug && item.status === "active"
        );

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }

  async findVariantBySkuCode(skuCode: string) {
    const products = this.isDatabaseConfigured()
      ? await this.findActiveDatabaseProductsBySkuCode(skuCode)
      : starterProducts;

    for (const product of products) {
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

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }

  private productInclude() {
    return {
      variants: true,
      images: { orderBy: { sortOrder: "asc" as const } }
    };
  }

  private async findActiveDatabaseProductBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: "active" },
      include: this.productInclude()
    });

    return product ? mapProductRecordToDetail(product as ProductRecord) : null;
  }

  private async findActiveDatabaseProductsBySkuCode(skuCode: string) {
    const products = await this.prisma.product.findMany({
      where: {
        status: "active",
        variants: { some: { skuCode } }
      },
      include: this.productInclude(),
      orderBy: { createdAt: "asc" }
    });

    return products.map((product) =>
      mapProductRecordToDetail(product as ProductRecord)
    );
  }
}
