import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { CreatedOrder, OrdersService } from "../orders/orders.service";
import { CreateRefundRequestDto } from "./dto/create-refund-request.dto";
import { RefundRequestStatus } from "./dto/update-refund-status.dto";

export type RefundStatus = "pending_review" | "approved" | "rejected";
export type RefundReviewRiskLevel = "low" | "medium" | "high";
export type RefundReviewPriority = "normal" | "expedite" | "blocked";
export type RefundReviewSlaStatus = "on_track" | "due_soon" | "overdue";

const REFUND_REVIEW_SLA_HOURS = 24;
const REFUND_REVIEW_DUE_SOON_HOURS = 4;

export interface RefundReviewRisk {
  level: RefundReviewRiskLevel;
  priority: RefundReviewPriority;
  reason: string;
}

export interface RefundReviewSla {
  policyHours: number;
  dueAt: string;
  hoursUntilDue: number;
  status: RefundReviewSlaStatus;
}

export interface RefundRequestRecord {
  refundNo: string;
  orderNo: string;
  customerPhone: string;
  reason: string;
  status: RefundStatus;
  requestedAmountCents: number;
  refundedAmountCents?: number;
  note?: string;
  createdAt: string;
  resolvedAt?: string;
  refundableBalanceCents?: number;
  remainingAfterRequestCents?: number;
  reviewRisk?: RefundReviewRisk;
  reviewSla?: RefundReviewSla;
}

@Injectable()
export class AfterSalesService {
  private readonly refunds = new Map<string, RefundRequestRecord>();
  private sequence = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService
  ) {}

  async createRefundRequest(dto: CreateRefundRequestDto) {
    const order = await this.ordersService.getOrder(dto.orderNo);
    const refundableBalanceCents = await this.getRefundableBalanceCents(order);

    this.assertRefundable(order, dto.requestedAmountCents, refundableBalanceCents);

    if (this.isDatabaseConfigured()) {
      const dbOrder = await this.prisma.order.findUnique({
        where: { orderNo: order.orderNo },
        select: { id: true }
      });

      if (!dbOrder) {
        throw new NotFoundException("Order not found");
      }

      const refund = await this.prisma.refundRequest.create({
        data: {
          refundNo: this.createRefundNo(),
          orderId: dbOrder.id,
          orderNo: order.orderNo,
          customerPhone: order.customer.phone,
          reason: dto.reason,
          requestedAmountCents: dto.requestedAmountCents
        }
      });
      await this.ordersService.updateOrderStatus(order.orderNo, "refunding");

      return this.toRefundRecord(refund);
    }

    const refund: RefundRequestRecord = {
      refundNo: this.createRefundNo(),
      orderNo: order.orderNo,
      customerPhone: order.customer.phone,
      reason: dto.reason,
      status: "pending_review",
      requestedAmountCents: dto.requestedAmountCents,
      createdAt: new Date().toISOString()
    };

    this.refunds.set(refund.refundNo, refund);
    await this.ordersService.updateOrderStatus(order.orderNo, "refunding");

    return refund;
  }

  async listRefundRequests() {
    const refundRecords = await this.listBaseRefundRequests();

    return Promise.all(
      refundRecords.map((refund) => this.withReviewContext(refund))
    );
  }

  private async listBaseRefundRequests() {
    if (this.isDatabaseConfigured()) {
      const refunds = await this.prisma.refundRequest.findMany({
        orderBy: { createdAt: "desc" }
      });

      return refunds.map((refund) => this.toRefundRecord(refund));
    }

    return Array.from(this.refunds.values()).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  async updateRefundStatus(
    refundNo: string,
    status: RefundRequestStatus,
    note?: string
  ) {
    if (this.isDatabaseConfigured()) {
      const existing = await this.prisma.refundRequest.findUnique({
        where: { refundNo }
      });

      if (!existing) {
        throw new NotFoundException("Refund request not found");
      }

      if (existing.status !== "pending_review") {
        throw new BadRequestException("Refund request already resolved");
      }

      const order = await this.ordersService.getOrder(existing.orderNo);
      const nextOrderStatus = await this.getOrderStatusAfterRefundResolution({
        order,
        refundNo,
        nextStatus: status,
        requestedAmountCents: existing.requestedAmountCents
      });
      const refundedAmountCents =
        status === "approved" ? existing.requestedAmountCents : null;
      const refund = await this.prisma.refundRequest.update({
        where: { refundNo },
        data: {
          status,
          note,
          refundedAmountCents,
          resolvedAt: new Date()
        }
      });
      await this.ordersService.updateOrderStatus(
        existing.orderNo,
        nextOrderStatus
      );

      return this.toRefundRecord(refund);
    }

    const refund = this.refunds.get(refundNo);

    if (!refund) {
      throw new NotFoundException("Refund request not found");
    }

    if (refund.status !== "pending_review") {
      throw new BadRequestException("Refund request already resolved");
    }

    const order = await this.ordersService.getOrder(refund.orderNo);
    const nextOrderStatus = await this.getOrderStatusAfterRefundResolution({
      order,
      refundNo,
      nextStatus: status,
      requestedAmountCents: refund.requestedAmountCents
    });
    const nextRefund: RefundRequestRecord = {
      ...refund,
      status,
      note,
      refundedAmountCents:
        status === "approved" ? refund.requestedAmountCents : undefined,
      resolvedAt: new Date().toISOString()
    };

    this.refunds.set(refundNo, nextRefund);
    await this.ordersService.updateOrderStatus(
      refund.orderNo,
      nextOrderStatus
    );

    return nextRefund;
  }

  private assertRefundable(
    order: CreatedOrder,
    requestedAmountCents: number,
    refundableBalanceCents: number
  ) {
    if (!["paid", "shipped", "completed", "refunding"].includes(order.status)) {
      throw new BadRequestException("Order is not refundable");
    }

    if (requestedAmountCents > order.totalCents) {
      throw new BadRequestException("Refund amount exceeds paid amount");
    }

    if (requestedAmountCents > refundableBalanceCents) {
      throw new BadRequestException("Refund amount exceeds refundable balance");
    }
  }

  private async getRefundableBalanceCents(
    order: CreatedOrder,
    excludeRefundNo?: string
  ) {
    const activeRefunds = (await this.listRefundsByOrderNo(order.orderNo)).filter(
      (refund) =>
        refund.refundNo !== excludeRefundNo &&
        (refund.status === "approved" || refund.status === "pending_review")
    );
    const lockedAmountCents = activeRefunds.reduce(
      (total, refund) =>
        total + (refund.refundedAmountCents ?? refund.requestedAmountCents),
      0
    );

    return Math.max(order.totalCents - lockedAmountCents, 0);
  }

  private async withReviewContext(refund: RefundRequestRecord) {
    const order = await this.ordersService.getOrder(refund.orderNo);
    const refundableBalanceCents = await this.getRefundableBalanceCents(
      order,
      refund.refundNo
    );
    const remainingAfterRequestCents =
      refundableBalanceCents - refund.requestedAmountCents;

    return {
      ...refund,
      refundableBalanceCents,
      remainingAfterRequestCents,
      reviewRisk: this.getRefundReviewRisk({
        refund,
        refundableBalanceCents,
        remainingAfterRequestCents
      }),
      reviewSla: this.getRefundReviewSla(refund)
    };
  }

  private getRefundReviewSla(refund: RefundRequestRecord): RefundReviewSla {
    const createdAtMs = new Date(refund.createdAt).getTime();
    const dueAtMs = createdAtMs + REFUND_REVIEW_SLA_HOURS * 60 * 60 * 1000;
    const hoursUntilDue = Math.ceil((dueAtMs - Date.now()) / (60 * 60 * 1000));
    const status =
      refund.status !== "pending_review"
        ? "on_track"
        : hoursUntilDue <= 0
          ? "overdue"
          : hoursUntilDue <= REFUND_REVIEW_DUE_SOON_HOURS
            ? "due_soon"
            : "on_track";

    return {
      policyHours: REFUND_REVIEW_SLA_HOURS,
      dueAt: new Date(dueAtMs).toISOString(),
      hoursUntilDue,
      status
    };
  }

  private getRefundReviewRisk(input: {
    refund: RefundRequestRecord;
    refundableBalanceCents: number;
    remainingAfterRequestCents: number;
  }): RefundReviewRisk {
    if (input.refund.status !== "pending_review") {
      return {
        level: "low",
        priority: "normal",
        reason: "Request has been resolved"
      };
    }

    if (input.refund.requestedAmountCents > input.refundableBalanceCents) {
      return {
        level: "high",
        priority: "blocked",
        reason: "Request exceeds remaining refundable balance"
      };
    }

    if (input.remainingAfterRequestCents === 0) {
      return {
        level: "medium",
        priority: "expedite",
        reason: "Request will fully refund the order"
      };
    }

    return {
      level: "low",
      priority: "normal",
      reason: "Request is within refundable balance"
    };
  }

  private async getOrderStatusAfterRefundResolution(input: {
    order: CreatedOrder;
    refundNo: string;
    nextStatus: RefundRequestStatus;
    requestedAmountCents: number;
  }) {
    if (input.nextStatus === "rejected") {
      return (await this.hasOtherPendingRefund(input.refundNo, input.order.orderNo))
        ? "refunding"
        : "paid";
    }

    const activeRefunds = (await this.listRefundsByOrderNo(input.order.orderNo)).filter(
      (refund) =>
        refund.refundNo !== input.refundNo && refund.status === "approved"
    );
    const approvedAmountCents =
      activeRefunds.reduce(
        (total, refund) =>
          total + (refund.refundedAmountCents ?? refund.requestedAmountCents),
        0
      ) + input.requestedAmountCents;

    if (approvedAmountCents >= input.order.totalCents) {
      return "refunded";
    }

    return (await this.hasOtherPendingRefund(input.refundNo, input.order.orderNo))
      ? "refunding"
      : "paid";
  }

  private async hasOtherPendingRefund(refundNo: string, orderNo: string) {
    return (await this.listRefundsByOrderNo(orderNo)).some(
      (refund) =>
        refund.refundNo !== refundNo && refund.status === "pending_review"
    );
  }

  private async listRefundsByOrderNo(orderNo: string): Promise<RefundRequestRecord[]> {
    if (this.isDatabaseConfigured()) {
      const refunds = await this.prisma.refundRequest.findMany({
        where: { orderNo }
      });

      return refunds.map((refund) => this.toRefundRecord(refund));
    }

    return Array.from(this.refunds.values()).filter(
      (refund) => refund.orderNo === orderNo
    );
  }

  private toRefundRecord(refund: {
    refundNo: string;
    orderNo: string;
    customerPhone: string;
    reason: string;
    status: RefundStatus;
    requestedAmountCents: number;
    refundedAmountCents: number | null;
    note: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): RefundRequestRecord {
    return {
      refundNo: refund.refundNo,
      orderNo: refund.orderNo,
      customerPhone: refund.customerPhone,
      reason: refund.reason,
      status: refund.status,
      requestedAmountCents: refund.requestedAmountCents,
      refundedAmountCents: refund.refundedAmountCents ?? undefined,
      note: refund.note ?? undefined,
      createdAt: refund.createdAt.toISOString(),
      resolvedAt: refund.resolvedAt?.toISOString()
    };
  }

  private createRefundNo() {
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

    return `REF${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }
}
