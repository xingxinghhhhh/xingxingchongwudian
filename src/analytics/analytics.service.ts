import { Injectable } from "@nestjs/common";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { CommunityService } from "../community/community.service";
import {
  CreatedOrder,
  CreatedOrderItem,
  OrdersService,
  OrderStatus
} from "../orders/orders.service";
import { ReviewsService } from "../reviews/reviews.service";

const REVENUE_STATUSES = new Set<OrderStatus>([
  "paid",
  "refunding",
  "shipped",
  "completed"
]);

export interface MerchantAnalytics {
  revenue: {
    gmvCents: number;
    paidOrderCount: number;
    averageOrderValueCents: number;
  };
  conversion: {
    orderCount: number;
    paidOrderRate: number;
    statusBreakdown: Record<OrderStatus, number>;
  };
  customers: {
    customerCount: number;
    repeatCustomerCount: number;
    repeatPurchaseRate: number;
  };
  productRankings: Array<{
    skuCode: string;
    title: string;
    quantitySold: number;
    revenueCents: number;
  }>;
  customerSegments: CustomerSegment[];
  retentionFunnel: RetentionFunnelStage[];
  retentionSignals: {
    cloudPetCount: number;
    homepageVisitCount: number;
    communityPostCount: number;
    reviewCount: number;
    pendingReviewCount: number;
    pendingCommunityReportCount: number;
  };
}

export interface CustomerSegment {
  key:
    | "high_value_pet_parent"
    | "pet_parent_activation"
    | "commerce_without_pet"
    | "community_growth_fan"
    | "payment_recovery";
  title: string;
  description: string;
  memberCount: number;
  samplePhones: string[];
  actionLabel: string;
  priority: "high" | "medium" | "low";
}

export interface RetentionFunnelStage {
  key:
    | "cloud_pet_created"
    | "homepage_engaged"
    | "order_created"
    | "paid_customer"
    | "repeat_customer";
  title: string;
  count: number;
  conversionRate: number;
  dropOffCount: number;
  actionLabel: string;
}

interface CustomerSignal {
  phone: string;
  paidOrderCount: number;
  pendingOrderCount: number;
  totalPaidCents: number;
  petCount: number;
  homepageVisitCount: number;
  communityPostCount: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService,
    private readonly reviewsService: ReviewsService
  ) {}

  async getMerchantAnalytics(): Promise<MerchantAnalytics> {
    const [orders, pets, posts, reports, reviews] = await Promise.all([
      this.ordersService.listOrders(),
      this.cloudPetsService.listAdminPets(),
      this.communityService.listAdminPosts(),
      this.communityService.listReports(),
      this.reviewsService.listAdminReviews()
    ]);
    const paidOrders = orders.filter((order) => REVENUE_STATUSES.has(order.status));
    const gmvCents = paidOrders.reduce(
      (total, order) => total + order.totalCents,
      0
    );
    const customersByPhone = this.groupOrdersByCustomerPhone(orders);

    return {
      revenue: {
        gmvCents,
        paidOrderCount: paidOrders.length,
        averageOrderValueCents: this.average(gmvCents, paidOrders.length)
      },
      conversion: {
        orderCount: orders.length,
        paidOrderRate: this.percentage(paidOrders.length, orders.length),
        statusBreakdown: this.countOrdersByStatus(orders)
      },
      customers: {
        customerCount: customersByPhone.size,
        repeatCustomerCount: this.countRepeatCustomers(customersByPhone),
        repeatPurchaseRate: this.percentage(
          this.countRepeatCustomers(customersByPhone),
          customersByPhone.size
        )
      },
      productRankings: this.rankProductsByRevenue(paidOrders),
      customerSegments: this.buildCustomerSegments(orders, pets, posts),
      retentionFunnel: this.buildRetentionFunnel(orders, pets),
      retentionSignals: {
        cloudPetCount: pets.length,
        homepageVisitCount: pets.reduce(
          (total, pet) => total + (pet.homepageVisitCount ?? 0),
          0
        ),
        communityPostCount: posts.length,
        reviewCount: reviews.length,
        pendingReviewCount: reviews.filter(
          (review) => review.status === "pending_review"
        ).length,
        pendingCommunityReportCount: reports.filter(
          (report) => report.status === "pending_review"
        ).length
      }
    };
  }

  private groupOrdersByCustomerPhone(orders: CreatedOrder[]) {
    return orders.reduce<Map<string, CreatedOrder[]>>((groups, order) => {
      const existingOrders = groups.get(order.customer.phone) ?? [];
      existingOrders.push(order);
      groups.set(order.customer.phone, existingOrders);

      return groups;
    }, new Map());
  }

  private countRepeatCustomers(groups: Map<string, CreatedOrder[]>) {
    return Array.from(groups.values()).filter((orders) => orders.length > 1)
      .length;
  }

  private countOrdersByStatus(orders: CreatedOrder[]) {
    const statuses: OrderStatus[] = [
      "pending_payment",
      "paid",
      "refunding",
      "shipped",
      "completed",
      "cancelled",
      "refunded"
    ];

    return statuses.reduce<Record<OrderStatus, number>>((counts, status) => {
      counts[status] = orders.filter((order) => order.status === status).length;
      return counts;
    }, {} as Record<OrderStatus, number>);
  }

  private rankProductsByRevenue(orders: CreatedOrder[]) {
    const rankings = new Map<
      string,
      {
        skuCode: string;
        title: string;
        quantitySold: number;
        revenueCents: number;
      }
    >();

    orders.flatMap((order) => order.items).forEach((item) => {
      const current = rankings.get(item.skuCode) ?? this.createRanking(item);
      current.quantitySold += item.quantity;
      current.revenueCents += item.quantity * item.unitPriceCents;
      rankings.set(item.skuCode, current);
    });

    return Array.from(rankings.values())
      .sort((left, right) => right.revenueCents - left.revenueCents)
      .slice(0, 5);
  }

  private buildCustomerSegments(
    orders: CreatedOrder[],
    pets: Array<{
      petNo: string;
      ownerPhone: string;
      homepageVisitCount?: number;
    }>,
    posts: Array<{ petNo: string }>
  ): CustomerSegment[] {
    const signals = this.buildCustomerSignals(orders, pets, posts);

    return [
      this.createSegment({
        key: "high_value_pet_parent",
        title: "High-value cloud-pet parents",
        description:
          "Members with cloud pets and at least two paid orders. Best fit for bundles, VIP benefits, and loyalty upgrades.",
        actionLabel: "Send VIP bundle offer",
        priority: "high",
        signals: signals.filter(
          (signal) => signal.petCount > 0 && signal.paidOrderCount >= 2
        )
      }),
      this.createSegment({
        key: "pet_parent_activation",
        title: "Cloud-pet parents awaiting first order",
        description:
          "Members already emotionally activated by a cloud pet, but without a paid order yet.",
        actionLabel: "Push first-order coupon",
        priority: "high",
        signals: signals.filter(
          (signal) => signal.petCount > 0 && signal.paidOrderCount === 0
        )
      }),
      this.createSegment({
        key: "commerce_without_pet",
        title: "Commerce members without cloud pets",
        description:
          "Customers who have purchased but have not created a cloud pet, making them good candidates for long-term retention onboarding.",
        actionLabel: "Invite cloud-pet setup",
        priority: "medium",
        signals: signals.filter(
          (signal) => signal.paidOrderCount > 0 && signal.petCount === 0
        )
      }),
      this.createSegment({
        key: "community_growth_fan",
        title: "Community and homepage engaged members",
        description:
          "Members showing retention intent through pet homepage visits or community posts.",
        actionLabel: "Trigger growth-task streak",
        priority: "medium",
        signals: signals.filter(
          (signal) =>
            signal.homepageVisitCount + signal.communityPostCount > 0 &&
            signal.paidOrderCount < 2
        )
      }),
      this.createSegment({
        key: "payment_recovery",
        title: "Pending-payment recovery",
        description:
          "Members with pending orders and no paid order yet. Prioritize payment reminders or assisted checkout.",
        actionLabel: "Send payment reminder",
        priority: "high",
        signals: signals.filter(
          (signal) => signal.pendingOrderCount > 0 && signal.paidOrderCount === 0
        )
      })
    ];
  }

  private buildRetentionFunnel(
    orders: CreatedOrder[],
    pets: Array<{
      ownerPhone: string;
      homepageVisitCount?: number;
    }>
  ): RetentionFunnelStage[] {
    const petOwnerPhones = new Set(pets.map((pet) => pet.ownerPhone));
    const homepageEngagedPhones = new Set(
      pets
        .filter((pet) => (pet.homepageVisitCount ?? 0) > 0)
        .map((pet) => pet.ownerPhone)
    );
    const orderCreatedPhones = new Set(
      orders.map((order) => order.customer.phone)
    );
    const paidOrdersByPhone = this.groupOrdersByCustomerPhone(
      orders.filter((order) => REVENUE_STATUSES.has(order.status))
    );
    const paidCustomerPhones = new Set(paidOrdersByPhone.keys());
    const repeatCustomerPhones = new Set(
      Array.from(paidOrdersByPhone.entries())
        .filter(([, customerOrders]) => customerOrders.length > 1)
        .map(([phone]) => phone)
    );
    const stages = [
      {
        key: "cloud_pet_created",
        title: "Cloud pet created",
        count: petOwnerPhones.size,
        actionLabel: "Keep pet onboarding active"
      },
      {
        key: "homepage_engaged",
        title: "Homepage engaged",
        count: homepageEngagedPhones.size,
        actionLabel: "Promote shareable homepage"
      },
      {
        key: "order_created",
        title: "Order created",
        count: orderCreatedPhones.size,
        actionLabel: "Nudge cart and checkout"
      },
      {
        key: "paid_customer",
        title: "Paid customer",
        count: paidCustomerPhones.size,
        actionLabel: "Issue post-purchase task"
      },
      {
        key: "repeat_customer",
        title: "Repeat customer",
        count: repeatCustomerPhones.size,
        actionLabel: "Offer VIP bundle"
      }
    ] satisfies Array<Omit<RetentionFunnelStage, "conversionRate" | "dropOffCount">>;

    return stages.map((stage, index) => {
      const previousCount = index === 0 ? stage.count : stages[index - 1].count;

      return {
        ...stage,
        conversionRate: index === 0 ? 100 : this.percentage(stage.count, previousCount),
        dropOffCount: Math.max(previousCount - stage.count, 0)
      };
    });
  }

  private buildCustomerSignals(
    orders: CreatedOrder[],
    pets: Array<{
      petNo: string;
      ownerPhone: string;
      homepageVisitCount?: number;
    }>,
    posts: Array<{ petNo: string }>
  ) {
    const signals = new Map<string, CustomerSignal>();
    const petOwnerByPetNo = new Map(
      pets.map((pet) => [pet.petNo, pet.ownerPhone])
    );

    orders.forEach((order) => {
      const signal = this.ensureCustomerSignal(signals, order.customer.phone);

      if (REVENUE_STATUSES.has(order.status)) {
        signal.paidOrderCount += 1;
        signal.totalPaidCents += order.totalCents;
      }

      if (order.status === "pending_payment") {
        signal.pendingOrderCount += 1;
      }
    });

    pets.forEach((pet) => {
      const signal = this.ensureCustomerSignal(signals, pet.ownerPhone);
      signal.petCount += 1;
      signal.homepageVisitCount += pet.homepageVisitCount ?? 0;
    });

    posts.forEach((post) => {
      const ownerPhone = petOwnerByPetNo.get(post.petNo);

      if (!ownerPhone) {
        return;
      }

      this.ensureCustomerSignal(signals, ownerPhone).communityPostCount += 1;
    });

    return Array.from(signals.values());
  }

  private ensureCustomerSignal(
    signals: Map<string, CustomerSignal>,
    phone: string
  ) {
    const existing = signals.get(phone);

    if (existing) {
      return existing;
    }

    const signal: CustomerSignal = {
      phone,
      paidOrderCount: 0,
      pendingOrderCount: 0,
      totalPaidCents: 0,
      petCount: 0,
      homepageVisitCount: 0,
      communityPostCount: 0
    };
    signals.set(phone, signal);

    return signal;
  }

  private createSegment(input: Omit<CustomerSegment, "memberCount" | "samplePhones"> & {
    signals: CustomerSignal[];
  }): CustomerSegment {
    const samplePhones = input.signals
      .slice()
      .sort((left, right) => {
        const revenueDiff = right.totalPaidCents - left.totalPaidCents;

        if (revenueDiff !== 0) {
          return revenueDiff;
        }

        return left.phone.localeCompare(right.phone);
      })
      .slice(0, 5)
      .map((signal) => signal.phone);

    return {
      key: input.key,
      title: input.title,
      description: input.description,
      actionLabel: input.actionLabel,
      priority: input.priority,
      memberCount: input.signals.length,
      samplePhones
    };
  }

  private createRanking(item: CreatedOrderItem) {
    return {
      skuCode: item.skuCode,
      title: item.title,
      quantitySold: 0,
      revenueCents: 0
    };
  }

  private average(total: number, count: number) {
    return count === 0 ? 0 : Math.round(total / count);
  }

  private percentage(part: number, total: number) {
    return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1));
  }
}
