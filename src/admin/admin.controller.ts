import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { OrdersService } from "../orders/orders.service";
import { ProductsService } from "../products/products.service";
import { AdminTokenGuard } from "./admin-token.guard";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";

@Controller("admin")
@UseGuards(AdminTokenGuard)
export class AdminController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly ordersService: OrdersService
  ) {}

  @Get("products")
  async listProducts() {
    return {
      items: await this.productsService.listAdminProducts()
    };
  }

  @Get("orders")
  async listOrders() {
    return {
      items: await this.ordersService.listOrders()
    };
  }

  @Patch("orders/:orderNo/status")
  updateOrderStatus(
    @Param("orderNo") orderNo: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateOrderStatus(orderNo, dto.status);
  }
}
