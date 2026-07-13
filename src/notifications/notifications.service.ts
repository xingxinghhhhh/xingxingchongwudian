import { Injectable } from "@nestjs/common";
import { GrowthTaskCompletionRecord } from "../cloud-pets/cloud-pets.service";
import { CreatedOrder } from "../orders/orders.service";
import { ProductReviewRecord } from "../reviews/reviews.service";

export type MemberNotificationType =
  | "coupon_available"
  | "growth_task_completed"
  | "order_created"
  | "shipment_delivered"
  | "review_request"
  | "review_pending";

export interface MemberNotification {
  id: string;
  type: MemberNotificationType;
  title: string;
  body: string;
  sourceId: string;
  actionHref: string;
  createdAt: string;
  read: boolean;
}

@Injectable()
export class NotificationsService {
  buildMemberNotifications(input: {
    orders: CreatedOrder[];
    taskCompletions: GrowthTaskCompletionRecord[];
    reviews: ProductReviewRecord[];
  }): MemberNotification[] {
    const reviewedOrderSkus = new Set(
      input.reviews.map((review) => `${review.orderNo}:${review.skuCode}`)
    );
    const notifications: MemberNotification[] = [
      {
        id: "coupon-WELCOME20",
        type: "coupon_available",
        title: "WELCOME20 会员优惠可用",
        body: "首单或复购可在商城结算时使用欢迎优惠。",
        sourceId: "WELCOME20",
        actionHref: "/shop",
        createdAt: new Date().toISOString(),
        read: false
      }
    ];

    input.taskCompletions.slice(0, 5).forEach((completion) => {
      notifications.push({
        id: `growth-${completion.petNo}-${completion.taskKey}-${completion.completedDate}`,
        type: "growth_task_completed",
        title: "云养宠成长任务已完成",
        body: `${completion.completedDate} 完成 ${completion.taskKey}，成长积分已计入会员档案。`,
        sourceId: completion.petNo,
        actionHref: "/member",
        createdAt: completion.createdAt,
        read: false
      });
    });

    input.orders.forEach((order) => {
      notifications.push({
        id: `order-${order.orderNo}`,
        type: "order_created",
        title: "订单已进入会员档案",
        body: `${order.orderNo} 当前状态：${order.status}。`,
        sourceId: order.orderNo,
        actionHref: `/orders/${order.orderNo}`,
        createdAt: order.createdAt ?? new Date().toISOString(),
        read: false
      });

      if (order.shipment?.status === "delivered") {
        notifications.push({
          id: `shipment-${order.orderNo}`,
          type: "shipment_delivered",
          title: "包裹已签收",
          body: `${order.shipment.carrier} ${order.shipment.trackingNumber} 已送达，可以邀请用户评价。`,
          sourceId: order.orderNo,
          actionHref: `/orders/${order.orderNo}/tracking`,
          createdAt: order.shipment.deliveredAt ?? order.shipment.shippedAt,
          read: false
        });
      }

      order.items.forEach((item) => {
        const reviewKey = `${order.orderNo}:${item.skuCode}`;

        if (order.status === "completed" && !reviewedOrderSkus.has(reviewKey)) {
          notifications.push({
            id: `review-request-${reviewKey}`,
            type: "review_request",
            title: "邀请用户评价商品",
            body: `${item.title} 已完成履约，可沉淀真实买家评价。`,
            sourceId: order.orderNo,
            actionHref: "/shop",
            createdAt: order.createdAt ?? new Date().toISOString(),
            read: false
          });
        }
      });
    });

    input.reviews
      .filter((review) => review.status === "pending_review")
      .forEach((review) => {
        notifications.push({
          id: `review-pending-${review.reviewNo}`,
          type: "review_pending",
          title: "评价待审核",
          body: "你的评价已提交，商家审核后会展示在商品页。",
          sourceId: review.reviewNo,
          actionHref: "/member",
          createdAt: review.createdAt,
          read: false
        });
      });

    return notifications.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }
}
