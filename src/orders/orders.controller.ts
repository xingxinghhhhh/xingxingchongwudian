import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { PaymentsService } from "../payments/payments.service";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly authService: AuthService,
    private readonly paymentsService: PaymentsService
  ) {}

  @Get()
  listOrders(@Query("phone") phone?: string) {
    if (phone) {
      return this.ordersService.listOrdersByCustomerPhone(phone);
    }
    return this.ordersService.listOrders();
  }

  @Post()
  createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(dto);
  }

  @Get(":orderNo")
  getOrder(@Param("orderNo") orderNo: string) {
    return this.ordersService.getOrder(orderNo);
  }

  @Get(":orderNo/payment-attempts")
  async getOrderPaymentAttempts(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Param("orderNo") orderNo: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.paymentsService.listOrderPaymentAttemptsByMember(session.phone, orderNo);
  }

  @Post(":orderNo/cancel")
  async cancelOrder(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Param("orderNo") orderNo: string,
    @Body() dto: CancelOrderDto
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.paymentsService.cancelOrderByMember(session.phone, orderNo, dto);
  }

  @Get(":orderNo/tracking")
  getOrderTracking(@Param("orderNo") orderNo: string) {
    return this.ordersService.getOrderTracking(orderNo);
  }
}
