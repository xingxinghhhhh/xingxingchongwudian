import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get(":orderNo")
  getOrder(@Param("orderNo") orderNo: string) {
    return this.ordersService.getOrder(orderNo);
  }
}
