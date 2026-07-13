import { Injectable } from "@nestjs/common";
import {
  CloudPetProfile,
  CloudPetRecommendation,
  GrowthTask,
  GrowthTaskCompletionRecord
} from "../cloud-pets/cloud-pets.service";
import { CmsBlockRecord } from "../cms/cms.service";
import {
  CommunityEngagementSummary,
  CommunityPostResponse
} from "../community/community.service";
import { CreatedOrder } from "../orders/orders.service";
import { ProductReviewRecord } from "../reviews/reviews.service";

export type PersonalizedRecommendationType =
  | "product"
  | "growth_task"
  | "content";

export interface PersonalizedRecommendation {
  type: PersonalizedRecommendationType;
  targetId: string;
  title: string;
  description: string;
  actionHref: string;
  ctaLabel: string;
  score: number;
  reasonCodes: string[];
}

export interface PersonalizationSummary {
  petCount: number;
  orderCount: number;
  communitySignalCount: number;
  homepageVisitCount: number;
  reviewCount: number;
  cmsSignalCount: number;
  topReasonCodes: string[];
}

@Injectable()
export class PersonalizationService {
  buildProfile(input: {
    pets: CloudPetProfile[];
    orders: CreatedOrder[];
    communityPosts: CommunityPostResponse[];
    communityEngagement: CommunityEngagementSummary;
    reviews: ProductReviewRecord[];
    taskCompletions: GrowthTaskCompletionRecord[];
    homepageVisitCount: number;
    growthTasks: GrowthTask[];
    productRecommendations: CloudPetRecommendation[];
    cmsBlocks: CmsBlockRecord[];
  }): {
    recommendations: PersonalizedRecommendation[];
    summary: PersonalizationSummary;
  } {
    const recommendations = [
      ...this.buildProductRecommendations(input),
      ...this.buildGrowthTaskRecommendations(input),
      ...this.buildContentRecommendations(input)
    ]
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);

    return {
      recommendations,
      summary: {
        petCount: input.pets.length,
        orderCount: input.orders.length,
        communitySignalCount:
          input.communityPosts.length +
          input.communityEngagement.likedPostCount +
          input.communityEngagement.commentCount +
          input.communityEngagement.followingPetCount,
        homepageVisitCount: input.homepageVisitCount,
        reviewCount: input.reviews.length,
        cmsSignalCount: input.cmsBlocks.length,
        topReasonCodes: this.getTopReasonCodes(recommendations)
      }
    };
  }

  private buildProductRecommendations(input: {
    pets: CloudPetProfile[];
    orders: CreatedOrder[];
    communityPosts: CommunityPostResponse[];
    homepageVisitCount: number;
    productRecommendations: CloudPetRecommendation[];
  }): PersonalizedRecommendation[] {
    const hasOrder = input.orders.length > 0;
    const hasCommunitySignal = input.communityPosts.length > 0;
    const petNames = input.pets.map((pet) => pet.name).join("、");

    return input.productRecommendations.map((product) => {
      const reasonCodes = ["pet_profile_match"];

      if (hasOrder) {
        reasonCodes.push("repeat_purchase_context");
      } else {
        reasonCodes.push("first_order_activation");
      }

      if (hasCommunitySignal) {
        reasonCodes.push("community_behavior");
      }

      if (input.homepageVisitCount > 0) {
        reasonCodes.push("homepage_share_heat");
      }

      return {
        type: "product",
        targetId: product.slug,
        title: product.title,
        description: `${product.reason} ${
          petNames ? `已结合 ${petNames} 的档案和互动行为。` : ""
        }`,
        actionHref: "/shop",
        ctaLabel: "查看商品",
        score:
          90 +
          (hasCommunitySignal ? 5 : 0) +
          (hasOrder ? 3 : 8) +
          (input.homepageVisitCount > 0 ? 4 : 0),
        reasonCodes
      } satisfies PersonalizedRecommendation;
    });
  }

  private buildGrowthTaskRecommendations(input: {
    taskCompletions: GrowthTaskCompletionRecord[];
    growthTasks: GrowthTask[];
  }): PersonalizedRecommendation[] {
    const completedToday = new Set(
      input.taskCompletions
        .filter((completion) => completion.completedDate === this.getTodayDate())
        .map((completion) => completion.taskKey)
    );

    return input.growthTasks
      .filter((task) => !completedToday.has(task.key))
      .slice(0, 2)
      .map((task, index) => ({
        type: "growth_task",
        targetId: task.key,
        title: task.title,
        description: `${task.description} 完成后可获得 ${task.points} 成长积分。`,
        actionHref: "/member",
        ctaLabel: "完成任务",
        score: 82 - index,
        reasonCodes: ["retention_next_step", "growth_streak"]
      }));
  }

  private buildContentRecommendations(input: {
    cmsBlocks: CmsBlockRecord[];
    pets: CloudPetProfile[];
  }): PersonalizedRecommendation[] {
    return input.cmsBlocks.slice(0, 3).map((block, index) => ({
      type: "content",
      targetId: block.blockNo,
      title: block.title,
      description:
        input.pets.length > 0
          ? `${block.body} 已结合云养宠档案作为今日内容入口。`
          : block.body,
      actionHref: block.href ?? "/",
      ctaLabel: block.ctaLabel ?? "查看内容",
      score: 70 - index,
      reasonCodes: ["cms_campaign", "daily_content"]
    }));
  }

  private getTopReasonCodes(recommendations: PersonalizedRecommendation[]) {
    return Array.from(
      new Set(recommendations.flatMap((recommendation) => recommendation.reasonCodes))
    ).slice(0, 6);
  }

  private getTodayDate() {
    return new Date().toISOString().slice(0, 10);
  }
}
