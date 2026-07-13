import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { MemberCancelReason, OrderStatus, OrdersService } from "../orders/orders.service";
import { ConfirmPaymentIntentDto } from "./dto/confirm-payment-intent.dto";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { CreatePaymentIntentDto } from "./dto/create-payment-intent.dto";
import { PaymentNotifyDto } from "./dto/payment-notify.dto";
import {
  ConfirmProviderPaymentInput,
  LegacyPaymentProvider,
  MockAlipayPaymentAdapter,
  MockWechatPaymentAdapter,
  PaymentFailureCode,
  PaymentIntentStatus,
  PaymentProvider,
  PaymentProviderAdapter,
  resolveLegacyProvider,
  toLegacyProvider
} from "./payment-provider.adapter";

export interface PaymentIntentView {
  id: string;
  orderId: string;
  memberId: string;
  amount: number;
  currency: "CNY";
  provider: PaymentProvider;
  status: PaymentIntentStatus;
  providerTradeNo?: string;
  idempotencyKey: string;
  payUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  expiresAt?: string;
  expiredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  failureCode?: PaymentFailureCode;
  failureMessage?: string;
  failedAt?: string;
  attemptNo: number;
  previousPaymentIntentId?: string;
  remainingSeconds?: number;
  orderStatus: OrderStatus;
  orderCloseReason?: string;
  orderMemberCancelReason?: string;
  orderMemberCancelNote?: string;
  canRetry?: boolean;
}

export interface PaymentLedgerEntryView {
  id: string;
  orderId: string;
  paymentIntentId: string;
  memberId: string;
  type: "payment";
  direction: "credit";
  amount: number;
  currency: "CNY";
  provider: PaymentProvider;
  status: "pending" | "success" | "failed";
  providerTradeNo?: string;
  eventType: "payment_created" | "payment_confirmed" | "payment_failed" | "payment_expired" | "payment_cancelled";
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LegacyPaymentRecord {
  paymentNo: string;
  orderNo: string;
  provider: LegacyPaymentProvider;
  channel: "h5" | "jsapi" | "native";
  amountCents: number;
  status: "pending" | "paid" | "failed";
  payUrl: string;
  providerTradeNo?: string;
}

export interface PaymentNotifyResponse {
  success: true;
  orderNo: string;
  paymentStatus: "paid";
  orderStatus: "paid";
}

export interface ConfirmPaymentIntentResult {
  paymentIntent: PaymentIntentView;
  orderStatus: OrderStatus;
}

export interface CancelOrderByMemberResult {
  orderId: string;
  orderStatus: OrderStatus;
  closeReason?: string;
  memberCancelReason?: string;
  memberCancelNote?: string;
  closedAt?: string;
  inventoryReleased: boolean;
  paymentIntent?: {
    id: string;
    status: PaymentIntentStatus;
    cancelledAt?: string;
  };
}

export interface AdminPaymentListFilters {
  orderId?: string;
  status?: PaymentIntentStatus;
  provider?: PaymentProvider;
  overdue?: boolean;
  failureCode?: PaymentFailureCode;
}

export interface AdminPaymentDetailView {
  paymentIntent: PaymentIntentView;
  ledger: PaymentLedgerEntryView[];
  relatedIntents?: PaymentIntentView[];
}

export interface OrderPaymentAttemptView {
  paymentIntentId: string;
  attemptNo: number;
  provider: PaymentProvider;
  status: PaymentIntentStatus;
  failureCode?: PaymentFailureCode;
  failureMessage?: string;
  createdAt: string;
  failedAt?: string;
  paidAt?: string;
}

export interface OrderPaymentAttemptsView {
  orderId: string;
  attempts: OrderPaymentAttemptView[];
}

export interface ExpireOverduePaymentsResult {
  scannedCount: number;
  expiredIntentCount: number;
  closedOrderCount: number;
  inventoryReleasedCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    paymentIntentId: string;
    orderId: string;
    status: "expired" | "skipped" | "failed";
    reason?: string;
  }>;
}

interface MemoryPaymentIntentRecord {
  id: string;
  orderId: string;
  memberId: string;
  amount: number;
  currency: "CNY";
  provider: PaymentProvider;
  status: PaymentIntentStatus;
  providerTradeNo?: string;
  idempotencyKey: string;
  payUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  expiresAt?: string;
  expiredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  failureCode?: PaymentFailureCode;
  failureMessage?: string;
  failedAt?: string;
  attemptNo: number;
  previousPaymentIntentId?: string;
}
@Injectable()
export class PaymentsService {
  private readonly paymentIntents = new Map<string, MemoryPaymentIntentRecord>();
  private readonly paymentLedger: PaymentLedgerEntryView[] = [];
  private sequence = 0;
  private ledgerSequence = 0;
  private readonly adapters: Record<PaymentProvider, PaymentProviderAdapter> = {
    mock_wechat: new MockWechatPaymentAdapter(),
    mock_alipay: new MockAlipayPaymentAdapter()
  };

  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async createPaymentIntent(
    memberId: string,
    dto: CreatePaymentIntentDto
  ): Promise<PaymentIntentView> {
    const order = await this.assertPayableOrder(dto.orderId, memberId);
    const reusableIntent = await this.findReusableIntent(order.orderNo, memberId);

    if (reusableIntent) {
      return this.getPaymentIntent(memberId, reusableIntent.id);
    }

    const latestIntent = await this.findLatestOrderPaymentRecord(order.orderNo, memberId);
    const attemptNo = latestIntent ? latestIntent.attemptNo + 1 : 1;
    const previousPaymentIntentId = latestIntent?.status === "failed" ? latestIntent.id : undefined;
    const expiresAt = this.createPaymentExpiresAt();
    const adapter = this.adapters[dto.provider];
    const intentId = this.createPaymentIntentId();
    const providerPayment = await adapter.createPayment({
      paymentIntentId: intentId,
      orderId: order.orderNo,
      amount: order.totalCents
    });

    if (this.isDatabaseConfigured()) {
      const orderRecord = await this.prisma.order.findUnique({
        where: { orderNo: order.orderNo }
      });

      if (!orderRecord) {
        throw new NotFoundException("Order not found");
      }

      await this.prisma.payment.create({
        data: {
          id: intentId,
          amountCents: order.totalCents,
          attemptNo,
          currency: "CNY",
          idempotencyKey: this.createIntentIdempotencyKey(intentId),
          memberId,
          orderId: orderRecord.id,
          payUrl: providerPayment.payUrl,
          expiresAt,
          previousPaymentIntentId,
          provider: dto.provider,
          status: providerPayment.status
        }
      });

      await this.createDatabaseLedgerEntry({
        amount: order.totalCents,
        eventType: "payment_created",
        memberId,
        metadata: {
          attemptNo,
          orderId: order.orderNo,
          previousPaymentIntentId,
          status: providerPayment.status
        },
        orderRecordId: orderRecord.id,
        paymentIntentId: intentId,
        provider: dto.provider,
        status: "pending"
      });

      return this.getPaymentIntent(memberId, intentId);
    }

    const now = new Date().toISOString();
    const expiresAtIso = expiresAt.toISOString();
    this.paymentIntents.set(intentId, {
      amount: order.totalCents,
      attemptNo,
      createdAt: now,
      currency: "CNY",
      expiresAt: expiresAtIso,
      id: intentId,
      idempotencyKey: this.createIntentIdempotencyKey(intentId),
      memberId,
      orderId: order.orderNo,
      payUrl: providerPayment.payUrl,
      previousPaymentIntentId,
      provider: dto.provider,
      status: providerPayment.status,
      updatedAt: now
    });

    this.createMemoryLedgerEntry({
      amount: order.totalCents,
      eventType: "payment_created",
      memberId,
      metadata: {
        attemptNo,
        orderId: order.orderNo,
        previousPaymentIntentId,
        status: providerPayment.status
      },
      orderId: order.orderNo,
      paymentIntentId: intentId,
      provider: dto.provider,
      status: "pending"
    });

    return this.getPaymentIntent(memberId, intentId);
  }

  async getPaymentIntent(
    memberId: string,
    paymentIntentId: string
  ): Promise<PaymentIntentView> {
    if (this.isDatabaseConfigured()) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentIntentId },
        include: { order: true }
      });

      if (!payment) {
        throw new NotFoundException("Payment intent not found");
      }

      if (payment.memberId !== memberId) {
        throw new ForbiddenException("You can only access your own payment intent");
      }

      if (this.shouldExpirePayment(payment.status, payment.expiresAt)) {
        await this.expirePaymentIntent(payment.id);
        return this.getPaymentIntent(memberId, paymentIntentId);
      }

      return this.toDatabasePaymentIntentView(payment);
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    if (payment.memberId !== memberId) {
      throw new ForbiddenException("You can only access your own payment intent");
    }

    if (this.shouldExpirePayment(payment.status, payment.expiresAt)) {
      await this.expirePaymentIntent(payment.id);
      return this.getPaymentIntent(memberId, paymentIntentId);
    }

    return this.toMemoryPaymentIntentView(payment);
  }

  async listOrderPaymentAttemptsByMember(
    memberId: string,
    orderId: string
  ): Promise<OrderPaymentAttemptsView> {
    const order = await this.ordersService.getOrder(orderId);

    if (order.customer.phone !== memberId) {
      throw new NotFoundException("Order not found");
    }

    const attempts = this.isDatabaseConfigured()
      ? await this.prisma.payment.findMany({
          where: {
            memberId,
            order: { orderNo: orderId }
          },
          include: { order: true },
          orderBy: [{ attemptNo: "asc" }, { createdAt: "asc" }]
        })
      : Array.from(this.paymentIntents.values())
          .filter((payment) => payment.memberId === memberId && payment.orderId === orderId)
          .sort((left, right) => {
            if (left.attemptNo !== right.attemptNo) {
              return left.attemptNo - right.attemptNo;
            }

            return left.createdAt.localeCompare(right.createdAt);
          });

    return {
      orderId,
      attempts: attempts.map((attempt) => this.toOrderPaymentAttemptView(attempt))
    };
  }
  async confirmPaymentIntent(
    memberId: string,
    paymentIntentId: string,
    dto: ConfirmPaymentIntentDto,
    options?: { providerTradeNo?: string }
  ): Promise<ConfirmPaymentIntentResult> {
    const paymentIntent = await this.getPaymentIntent(memberId, paymentIntentId);

    if (paymentIntent.status === "expired") {
      throw new ConflictException({
        code: "PAYMENT_INTENT_EXPIRED",
        message: "Payment intent has expired"
      });
    }

    if (paymentIntent.status === "cancelled") {
      throw new ConflictException({
        code: "PAYMENT_INTENT_CANCELLED",
        message: "Payment intent has been cancelled"
      });
    }

    if (paymentIntent.status === "failed") {
      throw new ConflictException({
        code: "PAYMENT_INTENT_FAILED",
        message: "Payment intent has failed. Create a new payment attempt."
      });
    }

    if (this.shouldExpirePayment(paymentIntent.status, paymentIntent.expiresAt)) {
      await this.expirePaymentIntent(paymentIntent.id);
      throw new ConflictException({
        code: "PAYMENT_INTENT_EXPIRED",
        message: "Payment intent has expired"
      });
    }

    if (paymentIntent.status === "paid") {
      return {
        paymentIntent,
        orderStatus: paymentIntent.orderStatus
      };
    }

    const adapter = this.adapters[paymentIntent.provider];
    const providerConfirmation = await adapter.confirmPayment({
      amount: paymentIntent.amount,
      orderId: paymentIntent.orderId,
      paymentIntentId,
      providerTradeNo: options?.providerTradeNo,
      result: dto.result ?? "success"
    } satisfies ConfirmProviderPaymentInput);

    if (providerConfirmation.status === "failed") {
      const failedIntent = await this.markPaymentFailed(
        paymentIntentId,
        providerConfirmation.providerTradeNo,
        providerConfirmation.failureCode,
        providerConfirmation.failureMessage
      );

      return {
        orderStatus: failedIntent.orderStatus,
        paymentIntent: failedIntent
      };
    }

    const paidIntent = await this.markPaymentPaid(
      paymentIntentId,
      providerConfirmation.providerTradeNo
    );

    return {
      orderStatus: paidIntent.orderStatus,
      paymentIntent: paidIntent
    };
  }

  async cancelOrderByMember(
    memberId: string,
    orderId: string,
    dto: { reason: MemberCancelReason; note?: string }
  ): Promise<CancelOrderByMemberResult> {
    const order = await this.ordersService.getOrder(orderId);

    if (order.customer.phone !== memberId) {
      throw new NotFoundException("Order not found");
    }

    if (order.status === "paid") {
      throw new ConflictException({
        code: "ORDER_ALREADY_PAID",
        message: "Order has already been paid"
      });
    }

    if (order.status === "cancelled") {
      const latestPaymentIntent = await this.findLatestOrderPaymentIntentView(
        memberId,
        orderId
      );

      return {
        closeReason: order.closeReason,
        closedAt: order.closedAt,
        inventoryReleased: Boolean(order.inventoryReleasedAt),
        memberCancelNote: order.memberCancelNote,
        memberCancelReason: order.memberCancelReason,
        orderId,
        orderStatus: order.status,
        paymentIntent: latestPaymentIntent
          ? {
              cancelledAt: latestPaymentIntent.cancelledAt,
              id: latestPaymentIntent.id,
              status: latestPaymentIntent.status
            }
          : undefined
      };
    }

    if (order.status !== "pending_payment") {
      throw new ConflictException({
        code: "ORDER_ALREADY_CLOSED",
        message: "Order is not pending payment"
      });
    }

    const latestPaymentIntent = await this.findLatestOrderPaymentIntentView(
      memberId,
      orderId
    );

    if (
      latestPaymentIntent &&
      this.shouldExpirePayment(
        latestPaymentIntent.status,
        latestPaymentIntent.expiresAt
      )
    ) {
      await this.expirePaymentIntent(latestPaymentIntent.id);
      const expiredOrder = await this.ordersService.getOrder(orderId);
      const expiredPaymentIntent = await this.findLatestOrderPaymentIntentView(
        memberId,
        orderId
      );

      return {
        closeReason: expiredOrder.closeReason,
        closedAt: expiredOrder.closedAt,
        inventoryReleased: Boolean(expiredOrder.inventoryReleasedAt),
        memberCancelNote: expiredOrder.memberCancelNote,
        memberCancelReason: expiredOrder.memberCancelReason,
        orderId,
        orderStatus: expiredOrder.status,
        paymentIntent: expiredPaymentIntent
          ? {
              cancelledAt: expiredPaymentIntent.cancelledAt,
              id: expiredPaymentIntent.id,
              status: expiredPaymentIntent.status
            }
          : undefined
      };
    }

    if (latestPaymentIntent?.status === "paid") {
      throw new ConflictException({
        code: "ORDER_ALREADY_PAID",
        message: "Order has already been paid"
      });
    }

    let cancelledPaymentIntent: PaymentIntentView | undefined;

    if (
      latestPaymentIntent &&
      ["created", "pending", "cancelled"].includes(latestPaymentIntent.status)
    ) {
      cancelledPaymentIntent = await this.markPaymentCancelled(latestPaymentIntent.id, {
        memberCancelNote: dto.note,
        memberCancelReason: dto.reason
      });
    }

    const closeResult = await this.ordersService.closeUnpaidOrder(orderId, {
      closeReason: "MEMBER_CANCELLED",
      memberCancelNote: dto.note,
      memberCancelReason: dto.reason
    });

    return {
      closeReason: closeResult.order.closeReason,
      closedAt: closeResult.order.closedAt,
      inventoryReleased: closeResult.inventoryReleased,
      memberCancelNote: closeResult.order.memberCancelNote,
      memberCancelReason: closeResult.order.memberCancelReason,
      orderId,
      orderStatus: closeResult.order.status,
      paymentIntent: cancelledPaymentIntent
        ? {
            cancelledAt: cancelledPaymentIntent.cancelledAt,
            id: cancelledPaymentIntent.id,
            status: cancelledPaymentIntent.status
          }
        : undefined
    };
  }

  async createLegacyPayment(
    provider: LegacyPaymentProvider,
    dto: CreatePaymentDto,
    memberId?: string
  ): Promise<LegacyPaymentRecord> {
    const order = await this.ordersService.getOrder(dto.orderNo);
    const intent = await this.createPaymentIntent(memberId ?? order.customer.phone, {
      orderId: dto.orderNo,
      provider: resolveLegacyProvider(provider)
    });

    return {
      amountCents: intent.amount,
      channel: dto.channel,
      orderNo: intent.orderId,
      payUrl: intent.payUrl,
      paymentNo: intent.id,
      provider,
      providerTradeNo: intent.providerTradeNo,
      status: this.toLegacyPaymentStatus(intent.status)
    };
  }

  async notifyLegacyPayment(
    provider: LegacyPaymentProvider,
    dto: PaymentNotifyDto,
    memberId?: string
  ): Promise<PaymentNotifyResponse> {
    const resolvedMemberId = memberId ?? (await this.resolvePaymentMemberId(dto.paymentNo));
    const paymentIntent = await this.getPaymentIntent(resolvedMemberId, dto.paymentNo);

    if (paymentIntent.provider !== resolveLegacyProvider(provider)) {
      throw new NotFoundException("Payment intent not found");
    }

    if (paymentIntent.amount !== dto.paidAmountCents) {
      throw new BadRequestException("Paid amount does not match payment amount");
    }

    const result = await this.confirmPaymentIntent(
      resolvedMemberId,
      dto.paymentNo,
      { result: "success" },
      { providerTradeNo: dto.providerTradeNo }
    );

    if (result.paymentIntent.status !== "paid") {
      throw new BadRequestException("Payment confirmation failed");
    }

    return {
      success: true,
      orderNo: result.paymentIntent.orderId,
      orderStatus: "paid",
      paymentStatus: "paid"
    };
  }

  private async resolvePaymentMemberId(paymentIntentId: string) {
    if (this.isDatabaseConfigured()) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentIntentId }
      });

      if (!payment) {
        throw new NotFoundException("Payment intent not found");
      }

      return payment.memberId;
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    return payment.memberId;
  }

  async listAdminPayments(filters: AdminPaymentListFilters = {}) {
    const items = this.isDatabaseConfigured()
      ? await this.listDatabasePayments(filters)
      : await this.listMemoryPayments(filters);

    return {
      items
    };
  }

  async getAdminPayment(paymentIntentId: string): Promise<AdminPaymentDetailView> {
    if (this.isDatabaseConfigured()) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentIntentId },
        include: {
          ledgerEntries: {
            orderBy: { createdAt: "desc" }
          },
          order: true
        }
      });

      if (!payment) {
        throw new NotFoundException("Payment intent not found");
      }

      const relatedPayments = await this.prisma.payment.findMany({
        where: { orderId: payment.orderId },
        include: { order: true },
        orderBy: [{ attemptNo: "asc" }, { createdAt: "asc" }]
      });

      return {
        ledger: payment.ledgerEntries.map((entry) => ({
          amount: entry.amountCents,
          createdAt: entry.createdAt.toISOString(),
          currency: "CNY",
          direction: entry.direction,
          eventType: entry.eventType,
          id: entry.id,
          idempotencyKey: entry.idempotencyKey,
          memberId: entry.memberId,
          metadata: this.toMetadataRecord(entry.metadata),
          orderId: payment.order.orderNo,
          paymentIntentId: entry.paymentIntentId,
          provider: entry.provider,
          providerTradeNo: entry.providerTradeNo ?? undefined,
          status: entry.status,
          type: entry.type
        })),
        paymentIntent: await this.toDatabasePaymentIntentView(payment),
        relatedIntents: await Promise.all(
          relatedPayments.map((relatedPayment) => this.toDatabasePaymentIntentView(relatedPayment))
        )
      };
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    const relatedPayments = Array.from(this.paymentIntents.values())
      .filter((entry) => entry.orderId === payment.orderId)
      .sort((left, right) => {
        if (left.attemptNo !== right.attemptNo) {
          return left.attemptNo - right.attemptNo;
        }

        return left.createdAt.localeCompare(right.createdAt);
      });

    return {
      ledger: this.paymentLedger.filter((entry) => entry.paymentIntentId === paymentIntentId),
      paymentIntent: await this.toMemoryPaymentIntentView(payment),
      relatedIntents: await Promise.all(
        relatedPayments.map((relatedPayment) => this.toMemoryPaymentIntentView(relatedPayment))
      )
    };
  }

  async expirePaymentIntent(
    paymentIntentId: string,
    now = new Date()
  ): Promise<{
    paymentIntentId: string;
    orderId: string;
    status: "expired" | "skipped" | "failed";
    reason?: string;
    closedOrder: boolean;
    inventoryReleased: boolean;
  }> {
    if (this.isDatabaseConfigured()) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: paymentIntentId },
        include: { order: { include: { items: true } } }
      });

      if (!payment) {
        return {
          closedOrder: false,
          inventoryReleased: false,
          orderId: "",
          paymentIntentId,
          reason: "PAYMENT_INTENT_NOT_FOUND",
          status: "failed"
        };
      }

      if (!["created", "pending"].includes(payment.status)) {
        return {
          closedOrder: false,
          inventoryReleased: false,
          orderId: payment.order.orderNo,
          paymentIntentId,
          reason: `PAYMENT_ALREADY_${payment.status.toUpperCase()}`,
          status: "skipped"
        };
      }

      if (!payment.expiresAt || payment.expiresAt.getTime() > now.getTime()) {
        return {
          closedOrder: false,
          inventoryReleased: false,
          orderId: payment.order.orderNo,
          paymentIntentId,
          reason: "NOT_OVERDUE",
          status: "skipped"
        };
      }

      return this.prisma.$transaction(async (tx) => {
        const current = await tx.payment.findUnique({
          where: { id: paymentIntentId },
          include: { order: { include: { items: true } } }
        });

        if (!current) {
          return {
            closedOrder: false,
            inventoryReleased: false,
            orderId: "",
            paymentIntentId,
            reason: "PAYMENT_INTENT_NOT_FOUND",
            status: "failed" as const
          };
        }

        if (!["created", "pending"].includes(current.status)) {
          return {
            closedOrder: false,
            inventoryReleased: false,
            orderId: current.order.orderNo,
            paymentIntentId,
            reason: `PAYMENT_ALREADY_${current.status.toUpperCase()}`,
            status: "skipped" as const
          };
        }

        if (!current.expiresAt || current.expiresAt.getTime() > now.getTime()) {
          return {
            closedOrder: false,
            inventoryReleased: false,
            orderId: current.order.orderNo,
            paymentIntentId,
            reason: "NOT_OVERDUE",
            status: "skipped" as const
          };
        }

        await tx.payment.update({
          where: { id: paymentIntentId },
          data: {
            expiredAt: now,
            status: "expired"
          }
        });

        const ledgerKey = this.createLedgerIdempotencyKey(
          paymentIntentId,
          "payment_expired"
        );
        const existingLedger = await tx.paymentLedgerEntry.findUnique({
          where: { idempotencyKey: ledgerKey }
        });

        if (!existingLedger) {
          await tx.paymentLedgerEntry.create({
            data: {
              amountCents: current.amountCents,
              currency: "CNY",
              direction: "credit",
              eventType: "payment_expired",
              id: this.createLedgerEntryId(),
              idempotencyKey: ledgerKey,
              memberId: current.memberId,
              metadata: { reason: "PAYMENT_TIMEOUT" },
              orderId: current.orderId,
              paymentIntentId,
              provider: current.provider,
              providerTradeNo: current.providerTradeNo,
              status: "failed",
              type: "payment"
            }
          });
        }

        let closedOrder = false;
        let inventoryReleased = false;

        if (current.order.status === "pending_payment") {
          inventoryReleased = !current.order.inventoryReleasedAt;

          if (inventoryReleased) {
            for (const item of current.order.items) {
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stock: { increment: item.quantity } }
              });
            }
          }

          await tx.order.update({
            where: { id: current.orderId },
            data: {
              closedAt: now,
              closeReason: "PAYMENT_TIMEOUT",
              inventoryReleasedAt: inventoryReleased ? now : undefined,
              status: "cancelled"
            }
          });
          closedOrder = true;
        }

        return {
          closedOrder,
          inventoryReleased,
          orderId: current.order.orderNo,
          paymentIntentId,
          status: "expired" as const
        };
      });
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      return {
        closedOrder: false,
        inventoryReleased: false,
        orderId: "",
        paymentIntentId,
        reason: "PAYMENT_INTENT_NOT_FOUND",
        status: "failed"
      };
    }

    if (!["created", "pending"].includes(payment.status)) {
      return {
        closedOrder: false,
        inventoryReleased: false,
        orderId: payment.orderId,
        paymentIntentId,
        reason: `PAYMENT_ALREADY_${payment.status.toUpperCase()}`,
        status: "skipped"
      };
    }

    if (!payment.expiresAt || new Date(payment.expiresAt).getTime() > now.getTime()) {
      return {
        closedOrder: false,
        inventoryReleased: false,
        orderId: payment.orderId,
        paymentIntentId,
        reason: "NOT_OVERDUE",
        status: "skipped"
      };
    }

    const orderBefore = await this.ordersService.getOrder(payment.orderId);
    payment.status = "expired";
    payment.expiredAt = now.toISOString();
    payment.updatedAt = payment.expiredAt;
    this.paymentIntents.set(payment.id, payment);

    if (
      !this.paymentLedger.some(
        (entry) =>
          entry.paymentIntentId === paymentIntentId &&
          entry.eventType === "payment_expired"
      )
    ) {
      this.createMemoryLedgerEntry({
        amount: payment.amount,
        eventType: "payment_expired",
        memberId: payment.memberId,
        metadata: { reason: "PAYMENT_TIMEOUT" },
        orderId: payment.orderId,
        paymentIntentId,
        provider: payment.provider,
        providerTradeNo: payment.providerTradeNo,
        status: "failed"
      });
    }

    let closedOrder = false;
    let inventoryReleased = false;

    if (orderBefore.status === "pending_payment") {
      inventoryReleased = !orderBefore.inventoryReleasedAt;
      await this.ordersService.closeOrderForPaymentTimeout(payment.orderId);
      closedOrder = true;
    }

    return {
      closedOrder,
      inventoryReleased,
      orderId: payment.orderId,
      paymentIntentId,
      status: "expired"
    };
  }

  async scanExpiredPayments(
    options: { limit?: number; now?: Date } = {}
  ): Promise<ExpireOverduePaymentsResult> {
    const now = options.now ?? new Date();
    const limit = options.limit ?? 50;
    const candidates = this.isDatabaseConfigured()
      ? await this.prisma.payment.findMany({
          where: {
            expiresAt: { lte: now },
            status: { in: ["created", "pending"] }
          },
          orderBy: { expiresAt: "asc" },
          take: limit
        })
      : Array.from(this.paymentIntents.values())
          .filter(
            (payment) =>
              ["created", "pending"].includes(payment.status) &&
              payment.expiresAt &&
              new Date(payment.expiresAt).getTime() <= now.getTime()
          )
          .sort((left, right) => String(left.expiresAt).localeCompare(String(right.expiresAt)))
          .slice(0, limit);

    const results = [] as ExpireOverduePaymentsResult["results"];
    let closedOrderCount = 0;
    let inventoryReleasedCount = 0;
    let failedCount = 0;

    for (const candidate of candidates) {
      const result = await this.expirePaymentIntent(candidate.id, now);
      results.push({
        orderId: result.orderId,
        paymentIntentId: result.paymentIntentId,
        reason: result.reason,
        status: result.status
      });

      if (result.status === "failed") {
        failedCount += 1;
      }

      if (result.closedOrder) {
        closedOrderCount += 1;
      }

      if (result.inventoryReleased) {
        inventoryReleasedCount += 1;
      }
    }

    const expiredIntentCount = results.filter(
      (result) => result.status === "expired"
    ).length;
    const skippedCount = results.filter(
      (result) => result.status === "skipped"
    ).length;

    return {
      closedOrderCount,
      expiredIntentCount,
      failedCount,
      inventoryReleasedCount,
      results,
      scannedCount: candidates.length,
      skippedCount
    };
  }
  private async markPaymentPaid(
    paymentIntentId: string,
    providerTradeNo?: string
  ): Promise<PaymentIntentView> {
    if (this.isDatabaseConfigured()) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentIntentId },
          include: { order: true }
        });

        if (!payment) {
          throw new NotFoundException("Payment intent not found");
        }

        if (payment.status === "paid") {
          return payment;
        }

        if (payment.status === "cancelled") {
          throw new ConflictException({
            code: "PAYMENT_INTENT_CANCELLED",
            message: "Payment intent has been cancelled"
          });
        }

        const paidAt = new Date();
        const nextProviderTradeNo = providerTradeNo ?? payment.providerTradeNo ?? payment.providerTxnId ?? undefined;
        const nextPayment = await tx.payment.update({
          where: { id: paymentIntentId },
          data: {
            paidAt,
            providerTradeNo: nextProviderTradeNo,
            providerTxnId: nextProviderTradeNo,
            status: "paid"
          },
          include: { order: true }
        });

        const ledgerKey = this.createLedgerIdempotencyKey(
          paymentIntentId,
          "payment_confirmed"
        );
        const existingLedger = await tx.paymentLedgerEntry.findUnique({
          where: { idempotencyKey: ledgerKey }
        });

        if (!existingLedger) {
          await tx.paymentLedgerEntry.create({
            data: {
              amountCents: payment.amountCents,
              currency: "CNY",
              direction: "credit",
              eventType: "payment_confirmed",
              id: this.createLedgerEntryId(),
              idempotencyKey: ledgerKey,
              memberId: payment.memberId,
              orderId: payment.orderId,
              paymentIntentId,
              provider: payment.provider,
              providerTradeNo: nextProviderTradeNo,
              status: "success",
              type: "payment"
            }
          });
        }

        if (payment.order.status !== "paid") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: { status: "paid" }
          });
        }

        return nextPayment;
      });

      return this.toDatabasePaymentIntentView(updated);
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    if (payment.status === "paid") {
      return this.toMemoryPaymentIntentView(payment);
    }

    if (payment.status === "cancelled") {
      throw new ConflictException({
        code: "PAYMENT_INTENT_CANCELLED",
        message: "Payment intent has been cancelled"
      });
    }

    payment.status = "paid";
    payment.providerTradeNo = providerTradeNo ?? payment.providerTradeNo;
    payment.paidAt = new Date().toISOString();
    payment.updatedAt = payment.paidAt;
    this.paymentIntents.set(payment.id, payment);

    if (
      !this.paymentLedger.some(
        (entry) =>
          entry.paymentIntentId === paymentIntentId &&
          entry.eventType === "payment_confirmed"
      )
    ) {
      this.createMemoryLedgerEntry({
        amount: payment.amount,
        eventType: "payment_confirmed",
        memberId: payment.memberId,
        orderId: payment.orderId,
        paymentIntentId,
        provider: payment.provider,
        providerTradeNo: payment.providerTradeNo,
        status: "success"
      });
    }

    const order = await this.ordersService.getOrder(payment.orderId);
    if (order.status !== "paid") {
      await this.ordersService.markOrderPaid(payment.orderId);
    }

    return this.toMemoryPaymentIntentView(payment);
  }

  private async markPaymentCancelled(
    paymentIntentId: string,
    input: { memberCancelReason: MemberCancelReason; memberCancelNote?: string }
  ): Promise<PaymentIntentView> {
    if (this.isDatabaseConfigured()) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentIntentId },
          include: { order: true }
        });

        if (!payment) {
          throw new NotFoundException("Payment intent not found");
        }

        if (payment.status === "paid") {
          throw new ConflictException({
            code: "ORDER_ALREADY_PAID",
            message: "Order has already been paid"
          });
        }

        if (payment.status === "cancelled") {
          return payment;
        }

        if (!["created", "pending"].includes(payment.status)) {
          return payment;
        }

        const cancelledAt = new Date();
        const nextPayment = await tx.payment.update({
          where: { id: paymentIntentId },
          data: {
            cancelledAt,
            cancelReason: "MEMBER_CANCELLED",
            status: "cancelled"
          },
          include: { order: true }
        });

        const ledgerKey = this.createLedgerIdempotencyKey(
          paymentIntentId,
          "payment_cancelled"
        );
        const existingLedger = await tx.paymentLedgerEntry.findUnique({
          where: { idempotencyKey: ledgerKey }
        });

        if (!existingLedger) {
          await tx.paymentLedgerEntry.create({
            data: {
              amountCents: payment.amountCents,
              currency: "CNY",
              direction: "credit",
              eventType: "payment_cancelled",
              id: this.createLedgerEntryId(),
              idempotencyKey: ledgerKey,
              memberId: payment.memberId,
              metadata: {
                closeReason: "MEMBER_CANCELLED",
                memberCancelNote: input.memberCancelNote,
                memberCancelReason: input.memberCancelReason
              },
              orderId: payment.orderId,
              paymentIntentId,
              provider: payment.provider,
              providerTradeNo: payment.providerTradeNo,
              status: "failed",
              type: "payment"
            }
          });
        }

        return nextPayment;
      });

      return this.toDatabasePaymentIntentView(updated);
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    if (payment.status === "paid") {
      throw new ConflictException({
        code: "ORDER_ALREADY_PAID",
        message: "Order has already been paid"
      });
    }

    if (payment.status === "cancelled") {
      return this.toMemoryPaymentIntentView(payment);
    }

    if (!["created", "pending"].includes(payment.status)) {
      return this.toMemoryPaymentIntentView(payment);
    }

    payment.status = "cancelled";
    payment.cancelledAt = new Date().toISOString();
    payment.cancelReason = "MEMBER_CANCELLED";
    payment.updatedAt = payment.cancelledAt;
    this.paymentIntents.set(payment.id, payment);

    if (
      !this.paymentLedger.some(
        (entry) =>
          entry.paymentIntentId === paymentIntentId &&
          entry.eventType === "payment_cancelled"
      )
    ) {
      this.createMemoryLedgerEntry({
        amount: payment.amount,
        eventType: "payment_cancelled",
        memberId: payment.memberId,
        metadata: {
          closeReason: "MEMBER_CANCELLED",
          memberCancelNote: input.memberCancelNote,
          memberCancelReason: input.memberCancelReason
        },
        orderId: payment.orderId,
        paymentIntentId,
        provider: payment.provider,
        providerTradeNo: payment.providerTradeNo,
        status: "failed"
      });
    }

    return this.toMemoryPaymentIntentView(payment);
  }
  private async markPaymentFailed(
    paymentIntentId: string,
    providerTradeNo?: string,
    failureCode?: PaymentFailureCode,
    failureMessage?: string
  ): Promise<PaymentIntentView> {
    if (this.isDatabaseConfigured()) {
      const updated = await this.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentIntentId },
          include: { order: true }
        });

        if (!payment) {
          throw new NotFoundException("Payment intent not found");
        }

        if (payment.status === "failed") {
          return payment;
        }

        const nextProviderTradeNo = providerTradeNo ?? payment.providerTradeNo ?? payment.providerTxnId ?? undefined;
        const failedAt = new Date();
        const nextPayment = await tx.payment.update({
          where: { id: paymentIntentId },
          data: {
            failedAt,
            failureCode,
            failureMessage,
            providerTradeNo: nextProviderTradeNo,
            providerTxnId: nextProviderTradeNo,
            status: "failed"
          },
          include: { order: true }
        });

        const ledgerKey = this.createLedgerIdempotencyKey(
          paymentIntentId,
          "payment_failed"
        );
        const existingLedger = await tx.paymentLedgerEntry.findUnique({
          where: { idempotencyKey: ledgerKey }
        });

        if (!existingLedger) {
          await tx.paymentLedgerEntry.create({
            data: {
              amountCents: payment.amountCents,
              currency: "CNY",
              direction: "credit",
              eventType: "payment_failed",
              id: this.createLedgerEntryId(),
              idempotencyKey: ledgerKey,
              memberId: payment.memberId,
              metadata: {
                attemptNo: payment.attemptNo,
                failureCode,
                failureMessage,
                previousPaymentIntentId: payment.previousPaymentIntentId
              } as never,
              orderId: payment.orderId,
              paymentIntentId,
              provider: payment.provider,
              providerTradeNo: nextProviderTradeNo,
              status: "failed",
              type: "payment"
            }
          });
        }

        return nextPayment;
      });

      return this.toDatabasePaymentIntentView(updated);
    }

    const payment = this.paymentIntents.get(paymentIntentId);

    if (!payment) {
      throw new NotFoundException("Payment intent not found");
    }

    if (payment.status === "failed") {
      return this.toMemoryPaymentIntentView(payment);
    }

    payment.failedAt = new Date().toISOString();
    payment.failureCode = failureCode;
    payment.failureMessage = failureMessage;
    payment.status = "failed";
    payment.providerTradeNo = providerTradeNo ?? payment.providerTradeNo;
    payment.updatedAt = payment.failedAt;
    this.paymentIntents.set(payment.id, payment);

    if (
      !this.paymentLedger.some(
        (entry) =>
          entry.paymentIntentId === paymentIntentId &&
          entry.eventType === "payment_failed"
      )
    ) {
      this.createMemoryLedgerEntry({
        amount: payment.amount,
        eventType: "payment_failed",
        memberId: payment.memberId,
        metadata: {
          attemptNo: payment.attemptNo,
          failureCode,
          failureMessage,
          previousPaymentIntentId: payment.previousPaymentIntentId
        },
        orderId: payment.orderId,
        paymentIntentId,
        provider: payment.provider,
        providerTradeNo: payment.providerTradeNo,
        status: "failed"
      });
    }

    return this.toMemoryPaymentIntentView(payment);
  }

  private async findLatestOrderPaymentIntentView(memberId: string, orderId: string) {
    const payment = await this.findLatestOrderPaymentRecord(orderId, memberId);
    return payment ? this.toPaymentIntentView(payment) : undefined;
  }

  private async findLatestOrderPaymentRecord(orderId: string, memberId: string) {
    if (this.isDatabaseConfigured()) {
      return this.prisma.payment.findFirst({
        where: {
          memberId,
          order: { orderNo: orderId }
        },
        include: { order: true },
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }]
      });
    }

    return Array.from(this.paymentIntents.values())
      .filter((item) => item.memberId === memberId && item.orderId === orderId)
      .sort((left, right) => {
        if (right.attemptNo !== left.attemptNo) {
          return right.attemptNo - left.attemptNo;
        }

        return right.createdAt.localeCompare(left.createdAt);
      })[0];
  }

  private async assertPayableOrder(orderId: string, memberId: string) {
    const order = await this.ordersService.getOrder(orderId);

    if (order.customer.phone !== memberId) {
      throw new ForbiddenException("You can only pay for your own order");
    }

    if (order.status === "paid") {
      throw new BadRequestException("Order has already been paid");
    }

    if (order.status !== "pending_payment") {
      throw new BadRequestException("Order is not pending payment");
    }

    return order;
  }

  private async findReusableIntent(orderId: string, memberId: string) {
    if (this.isDatabaseConfigured()) {
      return this.prisma.payment.findFirst({
        where: {
          memberId,
          order: { orderNo: orderId },
          status: { in: ["created", "pending"] }
        },
        include: { order: true },
        orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }]
      });
    }

    return Array.from(this.paymentIntents.values())
      .filter(
        (payment) =>
          payment.memberId === memberId &&
          payment.orderId === orderId &&
          ["created", "pending"].includes(payment.status)
      )
      .sort((left, right) => {
        if (right.attemptNo !== left.attemptNo) {
          return right.attemptNo - left.attemptNo;
        }

        return right.createdAt.localeCompare(left.createdAt);
      })[0];
  }

  private async listDatabasePayments(filters: AdminPaymentListFilters) {
    const payments = await this.prisma.payment.findMany({
      where: {
        failureCode: filters.failureCode,
        order: filters.orderId
          ? {
              orderNo: {
                contains: filters.orderId
              }
            }
          : undefined,
        provider: filters.provider,
        status: filters.status ?? (filters.overdue ? { in: ["created", "pending"] } : undefined),
        expiresAt: filters.overdue ? { lte: new Date() } : undefined
      },
      include: {
        order: true
      },
      orderBy: [{ attemptNo: "desc" }, { createdAt: "desc" }]
    });

    return Promise.all(payments.map((payment) => this.toDatabasePaymentIntentView(payment)));
  }

  private async listMemoryPayments(filters: AdminPaymentListFilters) {
    const payments = Array.from(this.paymentIntents.values())
      .filter((payment) => {
        if (filters.orderId && !payment.orderId.includes(filters.orderId)) {
          return false;
        }

        if (filters.provider && payment.provider !== filters.provider) {
          return false;
        }

        if (filters.status && payment.status !== filters.status) {
          return false;
        }

        if (filters.failureCode && payment.failureCode !== filters.failureCode) {
          return false;
        }

        if (filters.overdue && !filters.status && !["created", "pending"].includes(payment.status)) {
          return false;
        }

        if (
          filters.overdue &&
          (!payment.expiresAt || new Date(payment.expiresAt).getTime() > Date.now())
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (right.attemptNo !== left.attemptNo) {
          return right.attemptNo - left.attemptNo;
        }

        return right.createdAt.localeCompare(left.createdAt);
      });

    return Promise.all(payments.map((payment) => this.toMemoryPaymentIntentView(payment)));
  }

  private async toDatabasePaymentIntentView(payment: {
    id: string;
    amountCents: number;
    attemptNo: number;
    currency: string;
    memberId: string;
    order: {
      orderNo: string;
      status: OrderStatus;
      closeReason?: string | null;
      memberCancelReason?: string | null;
      memberCancelNote?: string | null;
    };
    payUrl: string;
    provider: PaymentProvider;
    providerTradeNo: string | null;
    idempotencyKey: string;
    status: PaymentIntentStatus;
    createdAt: Date;
    updatedAt: Date;
    paidAt: Date | null;
    expiresAt?: Date | null;
    expiredAt?: Date | null;
    cancelledAt?: Date | null;
    cancelReason?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    failedAt?: Date | null;
    previousPaymentIntentId?: string | null;
  }): Promise<PaymentIntentView> {
    return {
      amount: payment.amountCents,
      attemptNo: payment.attemptNo,
      cancelledAt: payment.cancelledAt?.toISOString(),
      cancelReason: payment.cancelReason ?? undefined,
      canRetry: this.canRetryPayment(payment.status, payment.order.status),
      createdAt: payment.createdAt.toISOString(),
      currency: "CNY",
      failedAt: payment.failedAt?.toISOString(),
      failureCode: (payment.failureCode as PaymentFailureCode | null | undefined) ?? undefined,
      failureMessage: payment.failureMessage ?? undefined,
      id: payment.id,
      idempotencyKey: payment.idempotencyKey,
      memberId: payment.memberId,
      orderId: payment.order.orderNo,
      orderStatus: payment.order.status,
      paidAt: payment.paidAt?.toISOString(),
      expiresAt: payment.expiresAt?.toISOString(),
      expiredAt: payment.expiredAt?.toISOString(),
      previousPaymentIntentId: payment.previousPaymentIntentId ?? undefined,
      remainingSeconds: this.getRemainingSeconds(payment.expiresAt),
      orderCloseReason: payment.order.closeReason ?? undefined,
      orderMemberCancelReason: payment.order.memberCancelReason ?? undefined,
      orderMemberCancelNote: payment.order.memberCancelNote ?? undefined,
      payUrl: payment.payUrl,
      provider: payment.provider,
      providerTradeNo: payment.providerTradeNo ?? undefined,
      status: payment.status,
      updatedAt: payment.updatedAt.toISOString()
    };
  }

  private async toMemoryPaymentIntentView(
    payment: MemoryPaymentIntentRecord
  ): Promise<PaymentIntentView> {
    const order = await this.ordersService.getOrder(payment.orderId);

    return {
      ...payment,
      canRetry: this.canRetryPayment(payment.status, order.status),
      orderCloseReason: order.closeReason,
      orderMemberCancelReason: order.memberCancelReason,
      orderMemberCancelNote: order.memberCancelNote,
      orderStatus: order.status,
      remainingSeconds: this.getRemainingSeconds(payment.expiresAt)
    };
  }

  private async toPaymentIntentView(payment: any): Promise<PaymentIntentView> {
    return this.isDatabaseConfigured()
      ? this.toDatabasePaymentIntentView(payment)
      : this.toMemoryPaymentIntentView(payment);
  }

  private toOrderPaymentAttemptView(payment: any): OrderPaymentAttemptView {
    return {
      attemptNo: payment.attemptNo,
      createdAt: payment.createdAt instanceof Date ? payment.createdAt.toISOString() : payment.createdAt,
      failedAt: payment.failedAt instanceof Date ? payment.failedAt.toISOString() : payment.failedAt,
      failureCode: (payment.failureCode as PaymentFailureCode | null | undefined) ?? undefined,
      failureMessage: payment.failureMessage ?? undefined,
      paidAt: payment.paidAt instanceof Date ? payment.paidAt.toISOString() : payment.paidAt,
      paymentIntentId: payment.id,
      provider: payment.provider,
      status: payment.status
    };
  }

  private canRetryPayment(status: PaymentIntentStatus, orderStatus: OrderStatus) {
    return status === "failed" && orderStatus === "pending_payment";
  }

  private createMemoryLedgerEntry(input: {
    orderId: string;
    paymentIntentId: string;
    memberId: string;
    amount: number;
    provider: PaymentProvider;
    status: "pending" | "success" | "failed";
    eventType: "payment_created" | "payment_confirmed" | "payment_failed" | "payment_expired" | "payment_cancelled";
    providerTradeNo?: string;
    metadata?: Record<string, unknown>;
  }) {
    const entry: PaymentLedgerEntryView = {
      amount: input.amount,
      createdAt: new Date().toISOString(),
      currency: "CNY",
      direction: "credit",
      eventType: input.eventType,
      id: this.createLedgerEntryId(),
      idempotencyKey: this.createLedgerIdempotencyKey(
        input.paymentIntentId,
        input.eventType
      ),
      memberId: input.memberId,
      metadata: input.metadata,
      orderId: input.orderId,
      paymentIntentId: input.paymentIntentId,
      provider: input.provider,
      providerTradeNo: input.providerTradeNo,
      status: input.status,
      type: "payment"
    };

    this.paymentLedger.unshift(entry);
    return entry;
  }

  private async createDatabaseLedgerEntry(input: {
    orderRecordId: string;
    paymentIntentId: string;
    memberId: string;
    amount: number;
    provider: PaymentProvider;
    status: "pending" | "success" | "failed";
    eventType: "payment_created" | "payment_confirmed" | "payment_failed" | "payment_expired" | "payment_cancelled";
    providerTradeNo?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.paymentLedgerEntry.create({
      data: {
        amountCents: input.amount,
        createdAt: new Date(),
        currency: "CNY",
        direction: "credit",
        eventType: input.eventType,
        id: this.createLedgerEntryId(),
        idempotencyKey: this.createLedgerIdempotencyKey(
          input.paymentIntentId,
          input.eventType
        ),
        memberId: input.memberId,
        metadata: input.metadata as never,
        orderId: input.orderRecordId,
        paymentIntentId: input.paymentIntentId,
        provider: input.provider,
        providerTradeNo: input.providerTradeNo,
        status: input.status,
        type: "payment"
      }
    });
  }

  private toLegacyPaymentStatus(status: PaymentIntentStatus) {
    if (status === "paid") {
      return "paid";
    }

    if (status === "failed" || status === "expired" || status === "cancelled") {
      return "failed";
    }

    return "pending";
  }

  private toMetadataRecord(metadata: unknown): Record<string, unknown> | undefined {
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      return undefined;
    }

    return metadata as Record<string, unknown>;
  }

  private createPaymentExpiresAt(now = new Date()) {
    const timeoutMinutes = Number(
      this.configService.get<string>("PAYMENT_TIMEOUT_MINUTES") ?? "30"
    );
    const safeTimeoutMinutes = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
      ? timeoutMinutes
      : 30;

    return new Date(now.getTime() + safeTimeoutMinutes * 60 * 1000);
  }

  private shouldExpirePayment(
    status: PaymentIntentStatus,
    expiresAt?: string | Date | null,
    now = new Date()
  ) {
    if (!["created", "pending"].includes(status) || !expiresAt) {
      return false;
    }

    return new Date(expiresAt).getTime() <= now.getTime();
  }

  private getRemainingSeconds(expiresAt?: string | Date | null) {
    if (!expiresAt) {
      return undefined;
    }

    return Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );
  }
  private createPaymentIntentId() {
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

  private createLedgerEntryId() {
    this.ledgerSequence += 1;
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `PL${timestamp}${String(this.ledgerSequence).padStart(4, "0")}`;
  }

  private createIntentIdempotencyKey(paymentIntentId: string) {
    return `payment_intent:${paymentIntentId}`;
  }

  private createLedgerIdempotencyKey(
    paymentIntentId: string,
    eventType: PaymentLedgerEntryView["eventType"]
  ) {
    return `payment_intent:${paymentIntentId}:${eventType}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}








