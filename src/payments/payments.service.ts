import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { OrdersService } from "../orders/orders.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentNotifyDto } from "./dto/payment-notify.dto";

export type PaymentProvider = "wechat" | "alipay";

export interface PaymentRecord {
  paymentNo: string;
  orderNo: string;
  provider: PaymentProvider;
  channel: "h5" | "jsapi" | "native";
  amountCents: number;
  status: "pending" | "paid";
  payUrl: string;
  providerTradeNo?: string;
}

export interface PaymentNotifyResponse {
  success: true;
  orderNo: string;
  paymentStatus: "paid";
  orderStatus: "paid";
}

@Injectable()
export class PaymentsService {
  private readonly payments = new Map<string, PaymentRecord>();
  private sequence = 0;

  constructor(private readonly ordersService: OrdersService) {}

  createPayment(
    provider: PaymentProvider,
    dto: CreatePaymentDto
  ): Promise<PaymentRecord> {
    return this.createPaymentRecord(provider, dto);
  }

  private async createPaymentRecord(
    provider: PaymentProvider,
    dto: CreatePaymentDto
  ): Promise<PaymentRecord> {
    const order = await this.ordersService.getOrder(dto.orderNo);

    if (order.status !== "pending_payment") {
      throw new BadRequestException("Order is not pending payment");
    }

    const payment: PaymentRecord = {
      paymentNo: this.createPaymentNo(),
      orderNo: order.orderNo,
      provider,
      channel: dto.channel,
      amountCents: order.totalCents,
      status: "pending",
      payUrl: `/mock-pay/${provider}/${order.orderNo}`
    };

    this.payments.set(payment.paymentNo, payment);
    return payment;
  }

  notifyPaid(
    provider: PaymentProvider,
    dto: PaymentNotifyDto
  ): Promise<PaymentNotifyResponse> {
    return this.markPaymentPaid(provider, dto);
  }

  private async markPaymentPaid(
    provider: PaymentProvider,
    dto: PaymentNotifyDto
  ): Promise<PaymentNotifyResponse> {
    const payment = this.payments.get(dto.paymentNo);

    if (!payment || payment.provider !== provider) {
      throw new NotFoundException("Payment not found");
    }

    if (payment.amountCents !== dto.paidAmountCents) {
      throw new BadRequestException("Paid amount does not match payment amount");
    }

    payment.status = "paid";
    payment.providerTradeNo = dto.providerTradeNo;
    this.payments.set(payment.paymentNo, payment);
    await this.ordersService.markOrderPaid(payment.orderNo);

    return {
      success: true,
      orderNo: payment.orderNo,
      paymentStatus: "paid",
      orderStatus: "paid"
    };
  }

  private createPaymentNo() {
    this.sequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `PAY${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }
}
