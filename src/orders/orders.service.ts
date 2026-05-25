import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../database/prisma.service";
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
  customer: CreateOrderDto["customer"];
  address: CreateOrderDto["address"];
  items: CreatedOrderItem[];
  totalCents: number;
}

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "shipped"
  | "completed"
  | "cancelled"
  | "refunded";

@Injectable()
export class OrdersService {
  private readonly orders = new Map<string, CreatedOrder>();

  constructor(
    private readonly productsService: ProductsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
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

    const totalCents = items.reduce(
      (total, item) => total + item.unitPriceCents * item.quantity,
      0
    );

    const order = {
      orderNo: this.createOrderNo(),
      status: "pending_payment",
      customer: dto.customer,
      address: dto.address,
      items,
      totalCents
    } satisfies CreatedOrder;

    this.orders.set(order.orderNo, order);
    return order;
  }

  async getOrder(orderNo: string): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.order.findUnique({
        where: { orderNo },
        include: { items: true }
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
        include: { items: true },
        orderBy: { createdAt: "desc" }
      });

      return orders.map((order) => this.toCreatedOrder(order));
    }

    return Array.from(this.orders.values());
  }

  async markOrderPaid(orderNo: string): Promise<CreatedOrder> {
    if (this.isDatabaseConfigured()) {
      const order = await this.prisma.order.update({
        where: { orderNo },
        data: { status: "paid" },
        include: { items: true }
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
      const order = await this.prisma.order.update({
        where: { orderNo },
        data: { status },
        include: { items: true }
      });

      return this.toCreatedOrder(order);
    }

    const order = await this.getOrder(orderNo);
    order.status = status;
    this.orders.set(orderNo, order);

    return order;
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

    const totalCents = items.reduce(
      (total, item) => total + item.unitPriceCents * item.quantity,
      0
    );
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
        include: { items: true }
      });
    });

    return this.toCreatedOrder(order);
  }

  private isDatabaseConfigured() {
    return Boolean(this.configService.get<string>("DATABASE_URL"));
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
    items: Array<{
      skuSnapshot: string;
      titleSnapshot: string;
      quantity: number;
      unitPriceCents: number;
    }>;
  }): CreatedOrder {
    return {
      orderNo: order.orderNo,
      status: order.status,
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
      totalCents: order.totalCents
    };
  }

  private createOrderNo() {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
      String(now.getSeconds()).padStart(2, "0")
    ].join("");

    return `KZT${timestamp}`;
  }
}
