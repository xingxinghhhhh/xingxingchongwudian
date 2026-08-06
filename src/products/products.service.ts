import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateAdminProductDto } from "../admin/dto/create-admin-product.dto";
import { PrismaService } from "../database/prisma.service";
import {
  ProductRecord,
  mapProductRecordToDetail
} from "./product.mapper";
import { starterProducts } from "./products.seed";
import {
  PetType,
  ProductDetail,
  ProductListItem,
  ProductSearchFilters,
  ProductSearchResult,
  ProductSort
} from "./product.types";

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
    const products = await this.listActiveProductDetails();
    return products.map((product) => this.toListItem(product));
  }

  async searchActiveProducts(
    filters: ProductSearchFilters = {}
  ): Promise<ProductSearchResult> {
    const products = await this.listActiveProductDetails();
    const normalizedFilters = this.normalizeProductSearchFilters(filters);
    const sort = normalizedFilters.sort ?? "default";

    const filteredProducts = products
      .filter((product) => this.matchesProductSearch(product, normalizedFilters))
      .sort((left, right) => this.compareProducts(left, right, sort));
    const recommendedProducts =
      filteredProducts.length === 0
        ? this.getSellableRecommendations(products)
        : [];

    return {
      items: filteredProducts.map((product) => this.toListItem(product)),
      meta: {
        total: filteredProducts.length,
        filters: this.toSearchMetaFilters(normalizedFilters),
        sort,
        availablePetTypes: this.getAvailablePetTypes(products),
        availableToyTypes: this.getAvailableToyTypes(products),
        availableTags: this.getAvailableTags(products),
        priceRange: this.getPriceRange(products),
        recommendedItems: recommendedProducts.map((product) =>
          this.toListItem(product)
        ),
        recommendationReason:
          recommendedProducts.length > 0
            ? "No exact match found, so we surfaced active in-stock toys to keep checkout moving."
            : undefined
      }
    };
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

  async createAdminProduct(dto: CreateAdminProductDto) {
    if (!this.isDatabaseConfigured()) {
      if (starterProducts.some((product) => product.slug === dto.slug)) {
        throw new ConflictException("Product slug already exists");
      }

      const skuCodes = new Set(
        starterProducts.flatMap((product) =>
          product.variants.map((variant) => variant.skuCode)
        )
      );

      for (const variant of dto.variants) {
        if (skuCodes.has(variant.skuCode)) {
          throw new ConflictException("Product SKU already exists");
        }
      }

      const product = {
        id: `prod_${dto.slug}`,
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        petType: dto.petType,
        toyType: dto.toyType,
        tags: this.buildAdminProductTags(dto),
        priceCents: Math.min(...dto.variants.map((variant) => variant.priceCents)),
        coverImageUrl: dto.images[0] ?? "",
        images: dto.images,
        status: dto.status ?? "draft",
        variants: dto.variants.map((variant) => ({
          id: `var_${variant.skuCode.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          skuCode: variant.skuCode,
          name: variant.name,
          color: variant.color ?? "",
          size: variant.size ?? "",
          material: variant.material ?? "",
          priceCents: variant.priceCents,
          compareAtCents: variant.compareAtCents,
          stock: variant.stock,
          isAvailable: variant.stock > 0
        }))
      };

      starterProducts.push(product);
      return product;
    }

    const product = await this.prisma.product.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        description: dto.description,
        petType: dto.petType,
        toyType: dto.toyType,
        status: dto.status ?? "draft",
        images: {
          create: dto.images.map((url, index) => ({
            url,
            sortOrder: index
          }))
        },
        variants: {
          create: dto.variants.map((variant) => ({
            skuCode: variant.skuCode,
            name: variant.name,
            color: variant.color,
            size: variant.size,
            material: variant.material,
            priceCents: variant.priceCents,
            compareAtCents: variant.compareAtCents,
            stock: variant.stock
          }))
        }
      },
      include: this.productInclude()
    });

    return mapProductRecordToDetail(product as ProductRecord);
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

  async updateProductStatus(
    slug: string,
    status: "active" | "draft" | "archived"
  ) {
    if (!this.isDatabaseConfigured()) {
      const product = starterProducts.find((item) => item.slug === slug);

      if (!product) {
        throw new NotFoundException("Product not found");
      }

      product.status = status;
      return product;
    }

    const product = await this.prisma.product.update({
      where: { slug },
      data: { status },
      include: this.productInclude()
    });

    return mapProductRecordToDetail(product as ProductRecord);
  }

  async updateVariantStock(skuCode: string, stock: number) {
    if (!this.isDatabaseConfigured()) {
      for (const product of starterProducts) {
        const variant = product.variants.find(
          (item) => item.skuCode === skuCode
        );

        if (variant) {
          variant.stock = stock;
          variant.isAvailable = stock > 0;
          return variant;
        }
      }

      throw new NotFoundException("Product variant not found");
    }

    const variant = await this.prisma.productVariant.update({
      where: { skuCode },
      data: { stock }
    });

    return {
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
    };
  }

  async reserveInventory(items: Array<{ skuCode: string; quantity: number }>) {
    if (this.isDatabaseConfigured()) {
      for (const item of items) {
        const stockUpdate = await this.prisma.productVariant.updateMany({
          where: {
            skuCode: item.skuCode,
            stock: { gte: item.quantity }
          },
          data: {
            stock: { decrement: item.quantity }
          }
        });

        if (stockUpdate.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for SKU ${item.skuCode}`
          );
        }
      }

      return;
    }

    const matchedItems = items.map((item) => {
      const match = this.findStarterVariantBySkuCode(item.skuCode);

      if (!match || match.variant.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for SKU ${item.skuCode}`);
      }

      return { ...item, variant: match.variant };
    });

    matchedItems.forEach((item) => {
      item.variant.stock -= item.quantity;
      item.variant.isAvailable = item.variant.stock > 0;
    });
  }

  async releaseInventory(items: Array<{ skuCode: string; quantity: number }>) {
    if (this.isDatabaseConfigured()) {
      for (const item of items) {
        await this.prisma.productVariant.update({
          where: { skuCode: item.skuCode },
          data: {
            stock: { increment: item.quantity }
          }
        });
      }

      return;
    }

    items.forEach((item) => {
      const match = this.findStarterVariantBySkuCode(item.skuCode);

      if (match) {
        match.variant.stock += item.quantity;
        match.variant.isAvailable = match.variant.stock > 0;
      }
    });
  }

  async listLowStockVariants(threshold = 5) {
    const products = await this.listAdminProducts();

    return products.flatMap((product) =>
      product.variants
        .filter((variant) => variant.stock <= threshold)
        .map((variant) => ({
          productSlug: product.slug,
          productTitle: product.title,
          skuCode: variant.skuCode,
          variantName: variant.name,
          stock: variant.stock,
          threshold,
          isAvailable: variant.isAvailable
        }))
    );
  }

  private isDatabaseConfigured() {
    return (
      this.configService.get<string>("KZT_USE_MEMORY_STORE") !== "true" &&
      Boolean(this.configService.get<string>("DATABASE_URL"))
    );
  }

  private productInclude() {
    return {
      variants: true,
      images: { orderBy: { sortOrder: "asc" as const } }
    };
  }

  private async listActiveProductDetails(): Promise<ProductDetail[]> {
    if (!this.isDatabaseConfigured()) {
      return starterProducts.filter((product) => product.status === "active");
    }

    try {
      const products = await this.prisma.product.findMany({
        where: { status: "active" },
        include: this.productInclude(),
        orderBy: { createdAt: "asc" }
      });

      return products.map((product) =>
        mapProductRecordToDetail(product as ProductRecord)
      );
    } catch (error) {
      if (this.isMissingProductTableError(error)) {
        return starterProducts.filter((product) => product.status === "active");
      }

      throw error;
    }
  }

  private isMissingProductTableError(error: unknown) {
    return (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2021"
    );
  }

  private toListItem(product: ProductDetail): ProductListItem {
    const { description: _description, images: _images, variants: _variants, ...listItem } =
      product;
    return listItem;
  }

  private toSearchMetaFilters(filters: ProductSearchFilters) {
    const metaFilters: Omit<ProductSearchFilters, "sort"> = {};

    if (filters.q) {
      metaFilters.q = filters.q;
    }

    if (filters.petType) {
      metaFilters.petType = filters.petType;
    }

    if (filters.toyType) {
      metaFilters.toyType = filters.toyType;
    }

    if (typeof filters.minPriceCents === "number") {
      metaFilters.minPriceCents = filters.minPriceCents;
    }

    if (typeof filters.maxPriceCents === "number") {
      metaFilters.maxPriceCents = filters.maxPriceCents;
    }

    return metaFilters;
  }

  private normalizeProductSearchFilters(
    filters: ProductSearchFilters
  ): ProductSearchFilters {
    const normalized: ProductSearchFilters = {};
    const q = filters.q?.trim();
    const toyType = filters.toyType?.trim();

    if (q) {
      normalized.q = q;
    }

    if (this.isPetType(filters.petType)) {
      normalized.petType = filters.petType;
    }

    if (toyType) {
      normalized.toyType = toyType.toLowerCase();
    }

    if (this.isValidPrice(filters.minPriceCents)) {
      normalized.minPriceCents = filters.minPriceCents;
    }

    if (this.isValidPrice(filters.maxPriceCents)) {
      normalized.maxPriceCents = filters.maxPriceCents;
    }

    if (this.isProductSort(filters.sort)) {
      normalized.sort = filters.sort;
    }

    return normalized;
  }

  private matchesProductSearch(
    product: ProductDetail,
    filters: ProductSearchFilters
  ) {
    if (filters.q && !this.matchesSearchText(product, filters.q)) {
      return false;
    }

    if (filters.petType && !this.matchesPetType(product.petType, filters.petType)) {
      return false;
    }

    if (
      filters.toyType &&
      product.toyType.toLowerCase() !== filters.toyType.toLowerCase()
    ) {
      return false;
    }

    if (
      typeof filters.minPriceCents === "number" &&
      product.priceCents < filters.minPriceCents
    ) {
      return false;
    }

    if (
      typeof filters.maxPriceCents === "number" &&
      product.priceCents > filters.maxPriceCents
    ) {
      return false;
    }

    return true;
  }

  private matchesSearchText(product: ProductDetail, q: string) {
    const query = q.toLowerCase();
    const haystack = [
      product.slug,
      product.title,
      product.description,
      product.petType,
      product.toyType,
      ...product.tags,
      ...product.variants.flatMap((variant) => [
        variant.skuCode,
        variant.name,
        variant.color,
        variant.size,
        variant.material
      ])
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  }

  private matchesPetType(productPetType: PetType, requestedPetType: PetType) {
    if (requestedPetType === "both") {
      return productPetType === "both";
    }

    return productPetType === requestedPetType || productPetType === "both";
  }

  private compareProducts(
    left: ProductDetail,
    right: ProductDetail,
    sort: ProductSort
  ) {
    if (sort === "price_asc") {
      return left.priceCents - right.priceCents;
    }

    if (sort === "price_desc") {
      return right.priceCents - left.priceCents;
    }

    return 0;
  }

  private getAvailablePetTypes(products: ProductDetail[]) {
    return [...new Set(products.map((product) => product.petType))].sort();
  }

  private getAvailableToyTypes(products: ProductDetail[]) {
    return [...new Set(products.map((product) => product.toyType))].sort();
  }

  private getAvailableTags(products: ProductDetail[]) {
    return [...new Set(products.flatMap((product) => product.tags))].sort();
  }

  private getPriceRange(products: ProductDetail[]) {
    const prices = products.map((product) => product.priceCents);

    if (prices.length === 0) {
      return {
        minCents: 0,
        maxCents: 0
      };
    }

    return {
      minCents: Math.min(...prices),
      maxCents: Math.max(...prices)
    };
  }

  private getSellableRecommendations(products: ProductDetail[]) {
    return products
      .filter((product) =>
        product.variants.some((variant) => variant.isAvailable && variant.stock > 0)
      )
      .sort((left, right) => left.priceCents - right.priceCents)
      .slice(0, 3);
  }

  private buildAdminProductTags(dto: CreateAdminProductDto) {
    return [
      ...new Set(
        [
          dto.toyType,
          ...dto.variants.flatMap((variant) => [
            variant.color,
            variant.size,
            variant.material
          ])
        ]
          .map((value) => value?.trim().toLowerCase().replace(/\s+/g, "-"))
          .filter((value): value is string => Boolean(value))
      )
    ].sort();
  }

  private isPetType(value: unknown): value is PetType {
    return value === "cat" || value === "dog" || value === "both";
  }

  private isProductSort(value: unknown): value is ProductSort {
    return value === "default" || value === "price_asc" || value === "price_desc";
  }

  private isValidPrice(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
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

  private findStarterVariantBySkuCode(skuCode: string) {
    for (const product of starterProducts) {
      const variant = product.variants.find((item) => item.skuCode === skuCode);

      if (variant && product.status === "active") {
        return { product, variant };
      }
    }

    return null;
  }
}
