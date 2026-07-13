import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CloudPetProfile,
  GrowthTask,
  GrowthTaskCompletionRecord
} from "../cloud-pets/cloud-pets.service";
import { CommunityPostResponse } from "../community/community.service";
import { CreatedOrder } from "../orders/orders.service";

export type LoyaltyTier = "bronze" | "silver" | "gold";
export type LoyaltyEventType =
  | "order_purchase"
  | "growth_task"
  | "community_post"
  | "pet_bond"
  | "points_redemption";

export interface LoyaltyLedgerEntry {
  eventType: LoyaltyEventType;
  sourceId: string;
  points: number;
  description: string;
  createdAt: string;
}

export interface LoyaltySummary {
  tier: LoyaltyTier;
  tierLabel: string;
  lifetimePoints: number;
  availablePoints: number;
  nextTier: Exclude<LoyaltyTier, "bronze"> | null;
  pointsToNextTier: number;
  progressPercent: number;
}

export interface LoyaltyProfile {
  summary: LoyaltySummary;
  ledger: LoyaltyLedgerEntry[];
  redemptionRewards: LoyaltyRedemptionReward[];
  redemptions: LoyaltyRedemption[];
  rules: Array<{
    eventType: LoyaltyEventType;
    title: string;
    description: string;
  }>;
}

export interface LoyaltyRedemptionReward {
  key: string;
  title: string;
  description: string;
  pointsCost: number;
  couponCode: string;
  discountCents: number;
  minSpendCents: number;
}

export interface LoyaltyRedemption {
  redemptionNo: string;
  rewardKey: string;
  title: string;
  couponCode: string;
  pointsCost: number;
  discountCents: number;
  remainingPoints: number;
  status: "issued";
  createdAt: string;
}

const redemptionRewards: LoyaltyRedemptionReward[] = [
  {
    key: "points-coupon-8",
    title: "80-point checkout coupon",
    description: "Redeem 80 points for CNY 8 off the next toy order.",
    pointsCost: 80,
    couponCode: "POINTS8",
    discountCents: 800,
    minSpendCents: 3000
  },
  {
    key: "points-coupon-20",
    title: "180-point premium coupon",
    description: "Redeem 180 points for CNY 20 off a larger restock order.",
    pointsCost: 180,
    couponCode: "POINTS20",
    discountCents: 2000,
    minSpendCents: 8000
  }
];

@Injectable()
export class LoyaltyService {
  private readonly redemptions = new Map<string, LoyaltyRedemption[]>();
  private redemptionSequence = 0;

  buildProfile(input: {
    phone: string;
    orders: CreatedOrder[];
    pets: CloudPetProfile[];
    communityPosts: CommunityPostResponse[];
    taskCompletions: GrowthTaskCompletionRecord[];
    growthTasks: GrowthTask[];
  }): LoyaltyProfile {
    const ledger = [
      ...this.buildOrderLedger(input.orders),
      ...this.buildTaskLedger(input.taskCompletions, input.growthTasks),
      ...this.buildCommunityLedger(input.communityPosts),
      ...this.buildPetBondLedger(input.pets)
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const lifetimePoints = ledger.reduce((total, entry) => total + entry.points, 0);
    const tier = this.getTier(lifetimePoints);
    const redemptions = this.listRedemptions(input.phone);
    const spentPoints = redemptions.reduce(
      (total, redemption) => total + redemption.pointsCost,
      0
    );
    const availablePoints = Math.max(lifetimePoints - spentPoints, 0);

    return {
      summary: this.getSummary(lifetimePoints, tier, availablePoints),
      ledger: [
        ...redemptions.map((redemption) => this.toRedemptionLedgerEntry(redemption)),
        ...ledger
      ].sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      redemptionRewards,
      redemptions,
      rules: this.getRules()
    };
  }

  getTier(points: number): LoyaltyTier {
    if (points >= 300) {
      return "gold";
    }

    if (points >= 100) {
      return "silver";
    }

    return "bronze";
  }

  getTierProgress(points: number, tier = this.getTier(points)) {
    return this.getSummary(points, tier, points);
  }

  redeemReward(input: {
    phone: string;
    rewardKey: string;
    availablePoints: number;
  }): LoyaltyRedemption {
    const reward = redemptionRewards.find((item) => item.key === input.rewardKey);

    if (!reward) {
      throw new BadRequestException("Loyalty reward not found");
    }

    if (input.availablePoints < reward.pointsCost) {
      throw new BadRequestException("Insufficient points for this reward");
    }

    const redemption: LoyaltyRedemption = {
      redemptionNo: this.createRedemptionNo(),
      rewardKey: reward.key,
      title: reward.title,
      couponCode: reward.couponCode,
      pointsCost: reward.pointsCost,
      discountCents: reward.discountCents,
      remainingPoints: input.availablePoints - reward.pointsCost,
      status: "issued",
      createdAt: new Date().toISOString()
    };
    const redemptions = this.redemptions.get(input.phone) ?? [];
    this.redemptions.set(input.phone, [redemption, ...redemptions]);

    return redemption;
  }

  private buildOrderLedger(orders: CreatedOrder[]): LoyaltyLedgerEntry[] {
    return orders.map((order) => ({
      eventType: "order_purchase",
      sourceId: order.orderNo,
      points: Math.floor(order.totalCents / 100),
      description: `Order ${order.orderNo} purchase reward`,
      createdAt: order.createdAt ?? order.orderNo.replace(/^KZT/, "")
    }));
  }

  private buildTaskLedger(
    completions: GrowthTaskCompletionRecord[],
    growthTasks: GrowthTask[]
  ): LoyaltyLedgerEntry[] {
    return completions.map((completion) => {
      const task = growthTasks.find((item) => item.key === completion.taskKey);

      return {
        eventType: "growth_task",
        sourceId: `${completion.petNo}:${completion.taskKey}:${completion.completedDate}`,
        points: task?.points ?? 0,
        description: task
          ? `Growth task completed: ${task.title}`
          : `Growth task completed: ${completion.taskKey}`,
        createdAt: completion.createdAt ?? completion.completedDate
      };
    });
  }

  private buildCommunityLedger(
    posts: CommunityPostResponse[]
  ): LoyaltyLedgerEntry[] {
    return posts.map((post) => ({
      eventType: "community_post",
      sourceId: post.postNo,
      points: 5,
      description: `Community post reward for ${post.petName}`,
      createdAt: post.createdAt
    }));
  }

  private buildPetBondLedger(pets: CloudPetProfile[]): LoyaltyLedgerEntry[] {
    return pets.map((pet) => ({
      eventType: "pet_bond",
      sourceId: pet.petNo,
      points: pet.stats.intimacy,
      description: `${pet.name} intimacy bond bonus`,
      createdAt: pet.timeline?.[0]?.createdAt ?? new Date(0).toISOString()
    }));
  }

  private getSummary(
    points: number,
    tier: LoyaltyTier,
    availablePoints: number
  ): LoyaltySummary {
    const thresholds = {
      bronze: 0,
      silver: 100,
      gold: 300
    };
    const nextTier = tier === "bronze" ? "silver" : tier === "silver" ? "gold" : null;
    const currentThreshold = thresholds[tier];
    const nextThreshold = nextTier ? thresholds[nextTier] : thresholds.gold;
    const range = Math.max(nextThreshold - currentThreshold, 1);

    return {
      tier,
      tierLabel:
        tier === "gold" ? "Gold companion" : tier === "silver" ? "Silver companion" : "Bronze companion",
      lifetimePoints: points,
      availablePoints,
      nextTier,
      pointsToNextTier: nextTier ? Math.max(nextThreshold - points, 0) : 0,
      progressPercent:
        nextTier === null
          ? 100
          : Math.min(100, Math.round(((points - currentThreshold) / range) * 100))
    };
  }

  private getRules() {
    return [
      {
        eventType: "order_purchase" as const,
        title: "Order purchase",
        description: "Earn 1 point for every CNY 1 actually paid."
      },
      {
        eventType: "growth_task" as const,
        title: "Cloud-pet growth task",
        description: "Earn the configured task points when a pet task is completed."
      },
      {
        eventType: "community_post" as const,
        title: "Community post",
        description: "Earn 5 points for each visible pet community post."
      },
      {
        eventType: "pet_bond" as const,
        title: "Pet bond bonus",
        description: "Pet intimacy contributes points to the member tier."
      },
      {
        eventType: "points_redemption" as const,
        title: "Points redemption",
        description: "Spend available points for checkout coupons and member benefits."
      }
    ];
  }

  private listRedemptions(phone: string) {
    return this.redemptions.get(phone) ?? [];
  }

  private toRedemptionLedgerEntry(
    redemption: LoyaltyRedemption
  ): LoyaltyLedgerEntry {
    return {
      eventType: "points_redemption",
      sourceId: redemption.redemptionNo,
      points: -redemption.pointsCost,
      description: `Redeemed ${redemption.title} (${redemption.couponCode})`,
      createdAt: redemption.createdAt
    };
  }

  private createRedemptionNo() {
    this.redemptionSequence += 1;
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    return `LPR${timestamp}${String(this.redemptionSequence).padStart(4, "0")}`;
  }
}
