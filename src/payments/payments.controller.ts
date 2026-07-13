import { Body, Controller, Get, Headers, HttpCode, Param, Post } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { ConfirmPaymentIntentDto } from "./dto/confirm-payment-intent.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentNotifyDto } from "./dto/payment-notify.dto";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly authService: AuthService
  ) {}

  @Post("intents")
  async createPaymentIntent(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Body() dto: CreatePaymentIntentDto
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.paymentsService.createPaymentIntent(session.phone, dto);
  }

  @Get(":paymentIntentId")
  async getPaymentIntent(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Param("paymentIntentId") paymentIntentId: string
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.paymentsService.getPaymentIntent(session.phone, paymentIntentId);
  }

  @Post(":paymentIntentId/confirm")
  async confirmPaymentIntent(
    @Headers("x-member-token") sessionToken: string | undefined,
    @Param("paymentIntentId") paymentIntentId: string,
    @Body() dto: ConfirmPaymentIntentDto
  ) {
    const session = await this.authService.getSession(sessionToken);

    return this.paymentsService.confirmPaymentIntent(
      session.phone,
      paymentIntentId,
      dto
    );
  }

  @Post("wechat")
  createWeChatPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createLegacyPayment("wechat", dto);
  }

  @Post("alipay")
  createAlipayPayment(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.createLegacyPayment("alipay", dto);
  }

  @Post("wechat/notify")
  @HttpCode(200)
  notifyWeChatPayment(@Body() dto: PaymentNotifyDto) {
    return this.paymentsService.notifyLegacyPayment("wechat", dto);
  }

  @Post("alipay/notify")
  @HttpCode(200)
  notifyAlipayPayment(@Body() dto: PaymentNotifyDto) {
    return this.paymentsService.notifyLegacyPayment("alipay", dto);
  }
}
