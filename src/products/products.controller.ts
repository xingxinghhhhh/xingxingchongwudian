import { Controller, Get, Param, Query } from "@nestjs/common";
import { PetType, ProductSearchFilters, ProductSort } from "./product.types";
import { ProductsService } from "./products.service";

interface ProductListQuery {
  q?: string;
  petType?: PetType;
  toyType?: string;
  minPriceCents?: string;
  maxPriceCents?: string;
  sort?: ProductSort;
}

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  listProducts(@Query() query: ProductListQuery) {
    return this.productsService.searchActiveProducts(this.toSearchFilters(query));
  }

  @Get(":slug")
  getProductDetail(@Param("slug") slug: string) {
    return this.productsService.getActiveProductBySlug(slug);
  }

  private toSearchFilters(query: ProductListQuery): ProductSearchFilters {
    return {
      q: query.q,
      petType: query.petType,
      toyType: query.toyType,
      minPriceCents: this.toOptionalNumber(query.minPriceCents),
      maxPriceCents: this.toOptionalNumber(query.maxPriceCents),
      sort: query.sort
    };
  }

  private toOptionalNumber(value: string | undefined) {
    if (value === undefined || value.trim() === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
}
