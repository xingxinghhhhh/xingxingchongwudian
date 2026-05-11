import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
  | "cancelled";

@Injectable()
export class OrdersService {
  private readonly orders = new Map<string, CreatedOrder>();

  constructor(private readonly productsService: ProductsService) {}

  createOrder(dto: CreateOrderDto): CreatedOrder {
    const items: CreatedOrderItem[] = dto.items.map((item) => {
      const match = this.productsService.findVariantBySkuCode(item.skuCode);

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
    });

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

  getOrder(orderNo: string): CreatedOrder {
    const order = this.orders.get(orderNo);

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return order;
  }

  listOrders(): CreatedOrder[] {
    return Array.from(this.orders.values());
  }

  markOrderPaid(orderNo: string): CreatedOrder {
    const order = this.getOrder(orderNo);
    order.status = "paid";
    this.orders.set(orderNo, order);

    return order;
  }

  updateOrderStatus(orderNo: string, status: OrderStatus): CreatedOrder {
    const order = this.getOrder(orderNo);
    order.status = status;
    this.orders.set(orderNo, order);

    return order;
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
