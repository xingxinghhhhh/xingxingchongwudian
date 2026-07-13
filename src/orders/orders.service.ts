import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
import { LoyaltyService, LoyaltyTier } from "../loyalty/loyalty.service";
import { MarketingService } from "../marketing/marketing.service";
import { ProductsService } from "../products/products.service";
import { CreateOrderDto } from "./dto/create-order.dto";

export interface CreatedOrderItem {
  skuCode: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
}

export interface CreatedOrder {
  orderNo: string;
  status: OrderStatus;
  createdAt?: string;
  closedAt?: string;
  closeReason?: OrderCloseReason;
  memberCancelReason?: MemberCancelReason;
  memberCancelNote?: string;
  inventoryReleasedAt?: string;
  customer: CreateOrderDto["customer"];
  address: CreateOrderDto["address"];
  items: CreatedOrderItem[];
  subtotalCents: number;
  memberTier?: LoyaltyTier;
  memberDiscountCents: number;
  discountCents: number;
  couponCode?: string;
  totalCents: number;
  shipment?: ShipmentRecord;
}

export type ShipmentStatus =
  | "created"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface ShipmentEventRecord {
  status: ShipmentStatus;
  location: string;
  description: string;
  happenedAt: string;
}

export interface ShipmentRecord {
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippedAt: string;
  deliveredAt?: string;
  events: ShipmentEventRecord[];
}

export interface OrderTracking {
  orderNo: string;
  orderStatus: OrderStatus;
  currentStatus?: ShipmentStatus;
  shipment?: Omit<ShipmentRecord, "events">;
  events: ShipmentEventRecord[];
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "refunding"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

export type OrderCloseReason =
  | "PAYMENT_TIMEOUT"
  | "MEMBER_CANCELLED"
  | "ADMIN_CANCELLED";

export type MemberCancelReason =
  | "ORDER_CREATED_BY_MISTAKE"
  | "CHANGED_MIND"
  | "WRONG_PRODUCT"
  | "WRONG_ADDRESS"
  | "FOUND_BETTER_OPTION"
  | "OTHER";

@Injectable()
export class OrdersService {
  private readonly orders = new Map<string, CreatedOrder>();
  private sequence = 0;

  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
    private readonly marketingService: MarketingService
  ) {}

  async createOrder(dto: CreateOrderDto): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      return this.createDatabaseOrder(dto);
    }

    const items: CreatedOrderItem[] = await Promise.all(
      dto.items.map(async (item) => {
        const match = await this.productsService.findVariantBySkuCode(
          item.skuCode
        );

        if (!match) {
          throw new BadRequestException(`Unknown SKU ${item.skuCode}`);
        }

        if (!match.variant.isAvailable || match.variant.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for SKU ${item.skuCode}`
          );
        }

        return {
          skuCode: match.variant.skuCode,
          title: match.product.title,
          quantity: item.quantity,
          unitPriceCents: match.variant.priceCents
        };
      })
    );

    const subtotalCents = items.reduce(
      (total, item) => total + item.unitPriceCents * item.quantity,
      0
    );
    const memberPricing = await this.getMemberPricing(
      dto.customer.phone,
      subtotalCents
    );
    const couponBaseCents = subtotalCents - memberPricing.memberDiscountCents;
    await this.assertCouponUsageLimits(dto);
    const discount = await this.marketingService.resolveCoupons(
      this.getRequestedCouponCodes(dto),
      couponBaseCents,
      dto.customer.phone
    );
    await this.productsService.reserveInventory(
      items.map((item) => ({
        skuCode: item.skuCode,
        quantity: item.quantity
      }))
    );

    const order = {
      orderNo: this.createOrderNo(),
      status: "pending_payment",
      createdAt: new Date().toISOString(),
      customer: dto.customer,
      address: dto.address,
      items,
      subtotalCents,
      memberTier: memberPricing.memberTier,
      memberDiscountCents: memberPricing.memberDiscountCents,
      discountCents: discount.discountCents,
      couponCode: discount.couponCode,
      totalCents: couponBaseCents - discount.discountCents
    } satisfies CreatedOrder;

    this.orders.set(order.orderNo, order);
    this.marketingService.markCouponUsed({
      couponCode: order.couponCode,
      memberPhone: order.customer.phone,
      orderNo: order.orderNo
    });
    return order;
  }

  async getOrder(orderNo: string): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.order.findUnique({
        where: { orderNo },
        include: this.orderInclude()
      });

      if (!order) {
        throw new NotFoundException("Order not found");
      }

      return this.toCreatedOrder(order);
    }

    const order = this.orders.get(orderNo);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  async listOrders(): Promise<CreatedOrder[]> {
    if (this.isDatabaseConfigured()) {
      const orders = await this.prisma.order.findMany({
        include: this.orderInclude(),
        orderBy: { createdAt: "desc" }
      });

      return orders.map((order) => this.toCreatedOrder(order));
    }

    return Array.from(this.orders.values());
  }

  async listOrdersByCustomerPhone(phone: string): Promise<CreatedOrder[]> {
    const orders = await this.listOrders();

    return orders.filter((order) => order.customer.phone === phone);
  }

  async markOrderPaid(orderNo: string): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.order.update({
        where: { orderNo },
        data: { status: "paid" },
        include: this.orderInclude()
      });

      return this.toCreatedOrder(order);
    }

    const order = await this.getOrder(orderNo);
    order.status = "paid";
    this.orders.set(orderNo, order);

    return order;
  }

  async updateOrderStatus(
    orderNo: string,
    status: OrderStatus
  ): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { orderNo },
          include: { items: true }
        });

        if (!existingOrder) {
          throw new NotFoundException("Order not found");
        }

        const shouldReleaseInventory =
          this.shouldReleaseInventory(existingOrder.status, status) &&
          !existingOrder.inventoryReleasedAt;
        const closedAt = status === "cancelled" ? new Date() : undefined;

        if (shouldReleaseInventory) {
          for (const item of existingOrder.items) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } }
            });
          }
        }

        return tx.order.update({
          where: { orderNo },
          data: {
            status,
            closedAt,
            closeReason: status === "cancelled" ? "ADMIN_CANCELLED" : undefined,
            inventoryReleasedAt: shouldReleaseInventory ? new Date() : undefined
          },
          include: this.orderInclude()
        });
      });

      return this.toCreatedOrder(order);
    }

    const order = await this.getOrder(orderNo);
    const previousStatus = order.status;

    if (this.shouldReleaseInventory(previousStatus, status) && !order.inventoryReleasedAt) {
      await this.productsService.releaseInventory(
        order.items.map((item) => ({
          skuCode: item.skuCode,
          quantity: item.quantity
        }))
      );
    }

    order.status = status;
    if (status === "cancelled") {
      order.closedAt = new Date().toISOString();
      order.closeReason = order.closeReason ?? "ADMIN_CANCELLED";
    }
    if (["cancelled", "refunded"].includes(status) && !order.inventoryReleasedAt) {
      order.inventoryReleasedAt = new Date().toISOString();
    }
    this.orders.set(orderNo, order);

    return order;
  }

  async closeUnpaidOrder(
    orderNo: string,
    input: {
      closeReason: Extract<OrderCloseReason, "PAYMENT_TIMEOUT" | "MEMBER_CANCELLED">;
      memberCancelReason?: MemberCancelReason;
      memberCancelNote?: string;
      now?: Date;
    }
  ): Promise<{ order: CreatedOrder; inventoryReleased: boolean }> {
    const now = input.now ?? new Date();

    if (this.isDatabaseConfigured()) {
      const result = await this.prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { orderNo },
          include: { items: true }
        });

        if (!existingOrder) {
          throw new NotFoundException("Order not found");
        }

        if (existingOrder.status !== "pending_payment") {
          const currentOrder = await tx.order.findUniqueOrThrow({
            where: { orderNo },
            include: this.orderInclude()
          });

          return {
            inventoryReleased: false,
            order: currentOrder
          };
        }

        const shouldReleaseInventory = !existingOrder.inventoryReleasedAt;

        if (shouldReleaseInventory) {
          for (const item of existingOrder.items) {
            await tx.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { increment: item.quantity } }
            });
          }
        }

        const nextOrder = await tx.order.update({
          where: { orderNo },
          data: {
            closedAt: now,
            closeReason: input.closeReason,
            inventoryReleasedAt: shouldReleaseInventory ? now : undefined,
            memberCancelNote:
              input.closeReason === "MEMBER_CANCELLED"
                ? input.memberCancelNote
                : undefined,
            memberCancelReason:
              input.closeReason === "MEMBER_CANCELLED"
                ? input.memberCancelReason
                : undefined,
            status: "cancelled"
          },
          include: this.orderInclude()
        });

        return {
          inventoryReleased: shouldReleaseInventory,
          order: nextOrder
        };
      });

      return {
        inventoryReleased: result.inventoryReleased,
        order: await this.getOrder(orderNo)
      };
    }

    const order = await this.getOrder(orderNo);

    if (order.status !== "pending_payment") {
      return {
        inventoryReleased: false,
        order
      };
    }

    let inventoryReleased = false;

    if (!order.inventoryReleasedAt) {
      await this.productsService.releaseInventory(
        order.items.map((item) => ({
          skuCode: item.skuCode,
          quantity: item.quantity
        }))
      );
      order.inventoryReleasedAt = now.toISOString();
      inventoryReleased = true;
    }

    order.status = "cancelled";
    order.closedAt = now.toISOString();
    order.closeReason = input.closeReason;
    order.memberCancelReason =
      input.closeReason === "MEMBER_CANCELLED"
        ? input.memberCancelReason
        : undefined;
    order.memberCancelNote =
      input.closeReason === "MEMBER_CANCELLED"
        ? input.memberCancelNote
        : undefined;
    this.orders.set(orderNo, order);

    return {
      inventoryReleased,
      order
    };
  }

  async closeOrderForPaymentTimeout(orderNo: string): Promise<CreatedOrder> {
    const result = await this.closeUnpaidOrder(orderNo, {
      closeReason: "PAYMENT_TIMEOUT"
    });

    return result.order;
  }
  async fulfillOrder(
    orderNo: string,
    shipment: Pick<ShipmentRecord, "carrier" | "trackingNumber">
  ): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.order.update({
        where: { orderNo },
        data: {
          status: "shipped",
          shipments: {
            create: {
              carrier: shipment.carrier,
              trackingNumber: shipment.trackingNumber,
              status: "in_transit",
              shippedAt: new Date(),
              events: {
                create: {
                  status: "in_transit",
                  location: "Merchant warehouse",
                  description: "Shipment dispatched from merchant warehouse"
                }
              }
            }
          }
        },
        include: this.orderInclude()
      });

      return this.toCreatedOrder(order);
    }

    const order = await this.getOrder(orderNo);
    order.status = "shipped";
    order.shipment = {
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      status: "in_transit",
      shippedAt: new Date().toISOString(),
      events: [
        {
          status: "in_transit",
          location: "Merchant warehouse",
          description: "Shipment dispatched from merchant warehouse",
          happenedAt: new Date().toISOString()
        }
      ]
    };
    this.orders.set(orderNo, order);

    return order;
  }

  async recordShipmentEvent(
    orderNo: string,
    event: Pick<ShipmentEventRecord, "status" | "location" | "description">
  ): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.$transaction(async (tx) => {
        const existingOrder = await tx.order.findUnique({
          where: { orderNo },
          include: this.orderInclude()
        });

        if (!existingOrder) {
          throw new NotFoundException("Order not found");
        }

        const shipment = existingOrder.shipments[0];

        if (!shipment) {
          throw new NotFoundException("Shipment not found");
        }

        await tx.shipment.update({
          where: { id: shipment.id },
          data: {
            status: event.status,
            deliveredAt: event.status === "delivered" ? new Date() : undefined,
            events: {
              create: {
                status: event.status,
                location: event.location,
                description: event.description
              }
            }
          }
        });

        return tx.order.update({
          where: { orderNo },
          data: event.status === "delivered" ? { status: "completed" } : {},
          include: this.orderInclude()
        });
      });

      return this.toCreatedOrder(order);
    }

    const order = await this.getOrder(orderNo);

    if (!order.shipment) {
      throw new NotFoundException("Shipment not found");
    }

    const happenedAt = new Date().toISOString();
    order.shipment.status = event.status;
    order.shipment.events.unshift({
      ...event,
      happenedAt
    });

    if (event.status === "delivered") {
      order.status = "completed";
      order.shipment.deliveredAt = happenedAt;
    }

    this.orders.set(orderNo, order);

    return order;
  }

  async getOrderTracking(orderNo: string): Promise<OrderTracking> {
    const order = await this.getOrder(orderNo);

    return {
      orderNo: order.orderNo,
      orderStatus: order.status,
      currentStatus: order.shipment?.status,
      shipment: order.shipment
        ? {
            carrier: order.shipment.carrier,
            trackingNumber: order.shipment.trackingNumber,
            status: order.shipment.status,
            shippedAt: order.shipment.shippedAt,
            deliveredAt: order.shipment.deliveredAt
          }
        : undefined,
      events: order.shipment?.events ?? []
    };
  }

  private async createDatabaseOrder(dto: CreateOrderDto): Promise<CreatedOrder> {
    const items: Array<CreatedOrderItem & { variantId: string }> =
      await Promise.all(
        dto.items.map(async (item) => {
          const match = await this.productsService.findVariantBySkuCode(
            item.skuCode
          );

          if (!match) {
            throw new BadRequestException(`Unknown SKU ${item.skuCode}`);
          }

          if (!match.variant.isAvailable || match.variant.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for SKU ${item.skuCode}`
            );
          }

          return {
            variantId: match.variant.id,
            skuCode: match.variant.skuCode,
            title: match.product.title,
            quantity: item.quantity,
            unitPriceCents: match.variant.priceCents
          };
        })
      );

    const subtotalCents = items.reduce(
      (total, item) => total + item.unitPriceCents * item.quantity,
      0
    );
    const memberPricing = await this.getMemberPricing(
      dto.customer.phone,
      subtotalCents
    );
    const couponBaseCents = subtotalCents - memberPricing.memberDiscountCents;
    await this.assertCouponUsageLimits(dto);
    const discount = await this.marketingService.resolveCoupons(
      this.getRequestedCouponCodes(dto),
      couponBaseCents,
      dto.customer.phone
    );
    const totalCents = couponBaseCents - discount.discountCents;
    const orderNo = this.createOrderNo();

    const order = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: dto.customer.phone },
        update: { name: dto.customer.name },
        create: { name: dto.customer.name, phone: dto.customer.phone }
      });

      for (const item of items) {
        const stockUpdate = await tx.productVariant.updateMany({
          where: {
            id: item.variantId,
            stock: { gte: item.quantity }
          },
          data: {
            stock: { decrement: item.quantity }
          }
        });

        if (stockUpdate.count !== 1) {
          throw new BadRequestException(
            `Insufficient stock for SKU ${item.skuCode}`
          );
        }
      }

      return tx.order.create({
        data: {
          orderNo,
          customerId: customer.id,
          customerName: dto.customer.name,
          customerPhone: dto.customer.phone,
          receiverName: dto.address.receiverName,
          receiverPhone: dto.address.phone,
          province: dto.address.province,
          city: dto.address.city,
          district: dto.address.district,
          detail: dto.address.detail,
          status: "pending_payment",
          subtotalCents,
          discountCents: discount.discountCents,
          couponCode: discount.couponCode,
          totalCents,
          items: {
            create: items.map((item) => ({
              variantId: item.variantId,
              titleSnapshot: item.title,
              skuSnapshot: item.skuCode,
              unitPriceCents: item.unitPriceCents,
              quantity: item.quantity
            }))
          }
        },
        include: this.orderInclude()
      });
    });

    this.marketingService.markCouponUsed({
      couponCode: discount.couponCode,
      memberPhone: dto.customer.phone,
      orderNo
    });

    return {
      ...this.toCreatedOrder(order),
      memberTier: memberPricing.memberTier,
      memberDiscountCents: memberPricing.memberDiscountCents
    };
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
  }

  private getRequestedCouponCodes(dto: CreateOrderDto) {
    return [dto.couponCode, ...(dto.couponCodes ?? [])];
  }

  private async assertCouponUsageLimits(dto: CreateOrderDto) {
    const normalizedCodes = [
      ...new Set(
        this.getRequestedCouponCodes(dto)
          .map((couponCode) => couponCode?.trim().toUpperCase())
          .filter((couponCode): couponCode is string => Boolean(couponCode))
      )
    ];

    if (normalizedCodes.length === 0) {
      return;
    }

    const previousOrders = await this.listOrdersByCustomerPhone(dto.customer.phone);

    for (const couponCode of normalizedCodes) {
      const limit = this.marketingService.getUsageLimitPerMember(couponCode);

      if (!limit) {
        continue;
      }

      const usedCount = previousOrders.filter(
        (order) =>
          order.couponCode?.toUpperCase() === couponCode &&
          !["cancelled", "refunded"].includes(order.status)
      ).length;

      if (usedCount >= limit) {
        throw new BadRequestException(
          "Coupon has already been used by this member"
        );
      }
    }
  }

  private async getMemberPricing(memberPhone: string, subtotalCents: number) {
    const previousOrders = await this.listOrdersByCustomerPhone(memberPhone);
    const paidOrders = previousOrders.filter((order) =>
      ["paid", "shipped", "completed"].includes(order.status)
    );
    const lifetimePoints = paidOrders.reduce(
      (total, order) => total + Math.floor(order.totalCents / 100),
      0
    );
    const memberTier = this.loyaltyService.getTier(lifetimePoints);
    const discountRateByTier = {
      bronze: 0,
      silver: 0.05,
      gold: 0.1
    } satisfies Record<LoyaltyTier, number>;
    const memberDiscountCents = Math.round(
      subtotalCents * discountRateByTier[memberTier]
    );

    return {
      memberTier,
      memberDiscountCents
    };
  }

  private toCreatedOrder(order: {
    orderNo: string;
    status: OrderStatus;
    customerName: string;
    customerPhone: string;
    receiverName: string;
    receiverPhone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
    totalCents: number;
    createdAt?: Date;
    closedAt?: Date | null;
    closeReason?: string | null;
    memberCancelReason?: string | null;
    memberCancelNote?: string | null;
    inventoryReleasedAt?: Date | null;
    subtotalCents?: number;
    memberTier?: string | null;
    memberDiscountCents?: number;
    discountCents?: number;
    couponCode?: string | null;
    items: Array<{
      skuSnapshot: string;
      titleSnapshot: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    shipments?: Array<{
      id?: string;
      carrier: string;
      trackingNumber: string;
      status?: ShipmentStatus;
      shippedAt: Date | null;
      deliveredAt?: Date | null;
      events?: Array<{
        status: ShipmentStatus;
        location: string;
        description: string;
        happenedAt: Date;
      }>;
    }>;
  }): CreatedOrder {
    const latestShipment = order.shipments?.[0];

    return {
      orderNo: order.orderNo,
      status: order.status,
      createdAt: order.createdAt?.toISOString(),
      closedAt: order.closedAt?.toISOString(),
      closeReason: (order.closeReason as OrderCloseReason | null) ?? undefined,
      memberCancelReason:
        (order.memberCancelReason as MemberCancelReason | null) ?? undefined,
      memberCancelNote: order.memberCancelNote ?? undefined,
      inventoryReleasedAt: order.inventoryReleasedAt?.toISOString(),
      customer: {
        name: order.customerName,
        phone: order.customerPhone
      },
      address: {
        receiverName: order.receiverName,
        phone: order.receiverPhone,
        province: order.province,
        city: order.city,
        district: order.district,
        detail: order.detail
      },
      items: order.items.map((item) => ({
        skuCode: item.skuSnapshot,
        title: item.titleSnapshot,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents
      })),
      subtotalCents: order.subtotalCents ?? order.totalCents,
      memberTier: (order.memberTier as LoyaltyTier | null) ?? undefined,
      memberDiscountCents: order.memberDiscountCents ?? 0,
      discountCents: order.discountCents ?? 0,
      couponCode: order.couponCode ?? undefined,
      totalCents: order.totalCents,
      shipment: latestShipment
          ? {
            carrier: latestShipment.carrier,
            trackingNumber: latestShipment.trackingNumber,
            status: latestShipment.status ?? "created",
            shippedAt: latestShipment.shippedAt?.toISOString() ?? "",
            deliveredAt: latestShipment.deliveredAt?.toISOString(),
            events:
              latestShipment.events?.map((event) => ({
                status: event.status,
                location: event.location,
                description: event.description,
                happenedAt: event.happenedAt.toISOString()
              })) ?? []
          }
        : undefined
    };
  }

  private orderInclude() {
    return {
      items: true,
      shipments: {
        orderBy: { createdAt: "desc" as const },
        include: {
          events: {
            orderBy: { happenedAt: "desc" as const }
          }
        }
      }
    };
  }

  private createOrderNo() {
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

    return `KZT${timestamp}${String(this.sequence).padStart(4, "0")}`;
  }

  private shouldReleaseInventory(previousStatus: OrderStatus, nextStatus: OrderStatus) {
    const releasableStatuses: OrderStatus[] = ["cancelled", "refunded"];

    return (
      !releasableStatuses.includes(previousStatus) &&
      releasableStatuses.includes(nextStatus)
    );
  }
}
