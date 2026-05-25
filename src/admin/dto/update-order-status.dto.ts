import { IsIn } from "class-validator";
import { OrderStatus } from "../../orders/orders.service";

export class UpdateOrderStatusDto {
  @IsIn([
    "pending_payment",
    "paid",
    "shipped",
    "completed",
    "cancelled",
    "refunded"
  ])
  status: OrderStatus;
}
