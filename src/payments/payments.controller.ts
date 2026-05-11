import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentNotifyDto } from "./dto/payment-notify.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("wechat")
  createWeChatPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment("wechat", dto);
  }

  @Post("alipay")
  createAlipayPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment("alipay", dto);
  }

  @Post("wechat/notify")
  @HttpCode(200)
  notifyWeChatPayment(@Body() dto: PaymentNotifyDto) {
    return this.paymentsService.notifyPaid("wechat", dto);
  }

  @Post("alipay/notify")
  @HttpCode(200)
  notifyAlipayPayment(@Body() dto: PaymentNotifyDto) {
    return this.paymentsService.notifyPaid("alipay", dto);
  }
}
