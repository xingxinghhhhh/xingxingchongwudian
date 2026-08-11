import { Injectable } from "@nestjs/common";
import { CloudPetsService } from "../cloud-pets/cloud-pets.service";
import { CmsService } from "../cms/cms.service";
import { CommunityService } from "../community/community.service";
import { CustomersService } from "../customers/customers.service";
import { LoyaltyService, LoyaltyTier } from "../loyalty/loyalty.service";
import { MarketingService } from "../marketing/marketing.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OrdersService } from "../orders/orders.service";
import { PersonalizationService } from "../personalization/personalization.service";
import { ReviewsService } from "../reviews/reviews.service";
import {
  addCloudPetBusinessDays,
  getCloudPetBusinessDateKey
} from "../cloud-pets/cloud-pet-business-day";

export interface TaskActivityCalendarDay {
  date: string;
  completedCount: number;
  taskKeys: string[];
}

@Injectable()
export class MembersService {
  constructor(
    private readonly cloudPetsService: CloudPetsService,
    private readonly communityService: CommunityService,
    private readonly ordersService: OrdersService,
    private readonly loyaltyService: LoyaltyService,
    private readonly reviewsService: ReviewsService,
    private readonly notificationsService: NotificationsService,
    private readonly cmsService: CmsService,
    private readonly personalizationService: PersonalizationService,
    private readonly customersService: CustomersService,
    private readonly marketingService: MarketingService
  ) {}

  async getProfile(phone: string) {
    const [
      pets,
      orders,
      allPosts,
      taskCompletions,
      homepageVisitCount,
      reviews,
      communityEngagement,
      cmsBlocks,
      addresses
    ] = await Promise.all([
      this.cloudPetsService.listPetsByOwnerPhone(phone),
      this.ordersService.listOrdersByCustomerPhone(phone),
      this.communityService.listAdminPosts(),
      this.cloudPetsService.listTaskCompletionsByOwnerPhone(phone),
      this.cloudPetsService.countHomepageVisitsByOwnerPhone(phone),
      this.reviewsService.listReviewsByCustomerPhone(phone),
      this.communityService.getEngagementByMemberPhone(phone),
      this.cmsService.listPublishedBlocksBySlotPrefix("homepage"),
      Promise.resolve(this.customersService.listAddresses(phone))
    ]);
    const petNos = new Set(pets.map((pet) => pet.petNo));
    const communityPosts = allPosts.filter((post) => petNos.has(post.petNo));
    const recommendations =
      pets.length > 0
        ? await this.cloudPetsService.getRecommendations(pets[0].petNo)
        : [];
    const name =
      orders[0]?.customer.name ?? pets[0]?.ownerName ?? `会员 ${phone.slice(-4)}`;
    const growthTasks = this.cloudPetsService.listGrowthTasks();
    const loyalty = this.loyaltyService.buildProfile({
      phone,
      orders,
      pets,
      communityPosts,
      taskCompletions,
      growthTasks
    });
    const points = loyalty.summary.availablePoints;
    const tier = loyalty.summary.tier;
    const taskActivity = this.buildTaskActivity(taskCompletions);
    const personalization = this.personalizationService.buildProfile({
      pets,
      orders,
      communityPosts,
      communityEngagement,
      reviews,
      taskCompletions,
      homepageVisitCount,
      growthTasks,
      productRecommendations: recommendations,
      cmsBlocks
    });

    return {
      member: {
        phone,
        name,
        tier,
        points
      },
      loyalty,
      pets,
      orders,
      reviews,
      addresses,
      defaultAddress:
        addresses.find((address) => address.isDefault) ?? addresses[0] ?? null,
      communityEngagement,
      communityPosts,
      recommendations,
      personalizedRecommendations: personalization.recommendations,
      personalizationSummary: personalization.summary,
      growthTasks,
      taskActivity,
      notifications: this.notificationsService.buildMemberNotifications({
        orders,
        taskCompletions,
        reviews
      }),
      commercePlan: this.buildCommercePlan({
        hasOrder: orders.length > 0,
        hasPet: pets.length > 0,
        points,
        recommendations,
        tier,
        taskActivity
      })
    };
  }

  async redeemPoints(phone: string, rewardKey: string) {
    const profile = await this.getProfile(phone);

    const redemption = this.loyaltyService.redeemReward({
      phone,
      rewardKey,
      availablePoints: profile.loyalty.summary.availablePoints
    });

    this.marketingService.registerIssuedCoupon({
      couponCode: redemption.couponCode,
      memberPhone: phone,
      sourceId: redemption.redemptionNo
    });

    return redemption;
  }

  private buildCommercePlan(input: {
    hasOrder: boolean;
    hasPet: boolean;
    points: number;
    recommendations: Array<{ slug: string; title: string }>;
    tier: LoyaltyTier;
    taskActivity: ReturnType<MembersService["buildTaskActivity"]>;
  }) {
    return {
      tierProgress: this.getTierProgress(input.points, input.tier),
      benefits: this.getBenefits(input.tier, input.taskActivity.currentStreakDays),
      nextBestActions: this.getNextBestActions(input)
    };
  }

  private getTierProgress(points: number, tier: LoyaltyTier) {
    const progress = this.loyaltyService.getTierProgress(points, tier);

    return {
      currentTier: progress.tier,
      nextTier: progress.nextTier,
      pointsToNextTier: progress.pointsToNextTier,
      progressPercent: progress.progressPercent
    };
  }

  private getBenefits(tier: LoyaltyTier, currentStreakDays: number) {
    return [
      {
        key: "welcome-gift",
        title: "会员入门礼包",
        description: "为第一单准备的玩具搭配建议，可直接去商城完成转化。",
        href: "/shop",
        ctaLabel: "去商城使用",
        couponCode: "WELCOME20",
        discountCents: 2000,
        unlocked: true
      },
      {
        key: "streak-gift",
        title: "连续陪伴礼",
        description: "连续 3 天完成成长任务后，适合作为复购提醒和社群运营话术。",
        href: "/member",
        ctaLabel: "继续完成任务",
        unlocked: currentStreakDays >= 3
      },
      {
        key: "vip-bundle",
        title: "高价值会员组合",
        description: "银卡及以上会员展示更高客单价组合推荐。",
        href: "/shop",
        ctaLabel: "查看组合",
        unlocked: tier === "silver" || tier === "gold"
      }
    ];
  }

  private getNextBestActions(input: {
    hasOrder: boolean;
    hasPet: boolean;
    recommendations: Array<{ slug: string; title: string }>;
    taskActivity: ReturnType<MembersService["buildTaskActivity"]>;
  }) {
    const actions = [
      {
        key: "continue-streak",
        title: "保持今日陪伴",
        description: `再坚持 ${input.taskActivity.nextMilestone.remainingDays} 天可达成 ${input.taskActivity.nextMilestone.targetDays} 天习惯。`,
        href: "/member",
        ctaLabel: "完成成长任务"
      }
    ];

    if (!input.hasPet) {
      actions.push({
        key: "create-pet",
        title: "定制第一只云养宠",
        description: "有宠物档案后，商城推荐和社区互动会更精准。",
        href: "/cloud-pets",
        ctaLabel: "去定制"
      });
    }

    if (!input.hasOrder) {
      actions.push({
        key: "first-order",
        title: "完成第一单",
        description:
          input.recommendations[0]?.title ??
          "根据云养宠档案挑选第一件互动玩具。",
        href: "/shop",
        ctaLabel: "去商城"
      });
    }

    return actions;
  }

  private buildTaskActivity(
    completions: Array<{ completedDate: string; taskKey: string }>
  ) {
    const groupedTasks = new Map<string, Set<string>>();

    completions.forEach((completion) => {
      const taskKeys = groupedTasks.get(completion.completedDate) ?? new Set<string>();
      taskKeys.add(completion.taskKey);
      groupedTasks.set(completion.completedDate, taskKeys);
    });

    const activeDates = Array.from(groupedTasks.keys()).sort();
    const calendar = this.buildRecentCalendar(groupedTasks);
    const currentStreakDays = this.countCurrentStreak(groupedTasks);
    const longestStreakDays = this.countLongestStreak(activeDates);
    const nextMilestone = this.getNextMilestone(currentStreakDays);

    return {
      totalCompletedTasks: completions.length,
      activeDays: activeDates.length,
      currentStreakDays,
      longestStreakDays,
      nextMilestone,
      calendar
    };
  }

  private buildRecentCalendar(groupedTasks: Map<string, Set<string>>) {
    const days: TaskActivityCalendarDay[] = [];
    const today = this.getTodayDate();

    for (let offset = 13; offset >= 0; offset -= 1) {
      const dateKey = addCloudPetBusinessDays(today, -offset);
      const taskKeys = Array.from(groupedTasks.get(dateKey) ?? []);

      days.push({
        date: dateKey,
        completedCount: taskKeys.length,
        taskKeys
      });
    }

    return days;
  }

  private countCurrentStreak(groupedTasks: Map<string, Set<string>>) {
    let streak = 0;
    let cursor = this.getTodayDate();

    while (groupedTasks.has(cursor)) {
      streak += 1;
      cursor = addCloudPetBusinessDays(cursor, -1);
    }

    return streak;
  }

  private countLongestStreak(activeDates: string[]) {
    let longest = 0;
    let current = 0;
    let previousDate: string | undefined;

    activeDates.forEach((dateKey) => {
      if (!previousDate || addCloudPetBusinessDays(previousDate, 1) === dateKey) {
        current += 1;
      } else {
        current = 1;
      }

      longest = Math.max(longest, current);
      previousDate = dateKey;
    });

    return longest;
  }

  private getNextMilestone(currentStreakDays: number) {
    const targetDays = [3, 7, 14, 30].find((days) => days > currentStreakDays) ?? 30;

    return {
      targetDays,
      remainingDays: Math.max(targetDays - currentStreakDays, 0),
      label: `${targetDays} day retention habit`
    };
  }

  private getTodayDate() {
    return getCloudPetBusinessDateKey();
  }
}
