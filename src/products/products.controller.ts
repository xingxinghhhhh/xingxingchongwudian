import { Controller, Get, Param } from "@nestjs/common";
import { ProductsService } from "./products.service";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async listProducts() {
    return {
      items: await this.productsService.listActiveProducts()
    };
  }

  @Get(":slug")
  getProductDetail(@Param("slug") slug: string) {
    return this.productsService.getActiveProductBySlug(slug);
  }
}
