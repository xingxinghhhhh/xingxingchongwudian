import type {
  GrowthTask,
  MemberProfile,
  MemberRedemptionReward,
  PersonalizedRecommendation
} from "./member-api";
import { getGrowthTaskCopy } from "../cloud-pets/cloud-pet-copy";
import { getProductTitleLabel } from "../shop/shop-copy";

type LoyaltyEventType = MemberProfile["loyalty"]["rules"][number]["eventType"];
type MemberTier = MemberProfile["member"]["tier"];

const tierLabels: Record<MemberTier, string> = {
  bronze: "青铜会员",
  silver: "白银会员",
  gold: "黄金会员"
};

const loyaltyRuleCopy: Record<LoyaltyEventType, { title: string; description: string }> = {
  order_purchase: { title: "订单消费", description: "每实际支付 1 元可获得 1 积分。" },
  growth_task: { title: "云养宠成长任务", description: "完成宠物成长任务后获得对应积分。" },
  community_post: { title: "社区发帖", description: "每发布一条可见宠物动态可获得 5 积分。" },
  pet_bond: { title: "宠物亲密奖励", description: "宠物亲密度会计入会员等级积分。" },
  points_redemption: { title: "积分兑换", description: "使用可用积分兑换结算优惠券和会员权益。" }
};

const redemptionRewardCopy: Record<string, { title: string; description: string }> = {
  "points-coupon-8": { title: "80 积分结算券", description: "使用 80 积分兑换下笔玩具订单立减 8 元。" },
  "points-coupon-20": { title: "180 积分高级券", description: "使用 180 积分兑换大额补货订单立减 20 元。" }
};

const recommendationTypeLabels: Record<PersonalizedRecommendation["type"], string> = {
  product: "商品",
  growth_task: "成长任务",
  content: "内容"
};

const reasonCodeLabels: Record<string, string> = {
  pet_profile_match: "宠物档案匹配",
  repeat_purchase_context: "复购场景",
  first_order_activation: "首单引导",
  community_behavior: "社区行为",
  homepage_share_heat: "主页分享热度",
  retention_next_step: "下一步留存",
  growth_streak: "连续成长",
  cms_campaign: "运营活动",
  daily_content: "每日内容"
};

export function getMemberTierLabel(tier: MemberTier) {
  return tierLabels[tier];
}

export function getLoyaltyRuleCopy(eventType: LoyaltyEventType) {
  return loyaltyRuleCopy[eventType];
}

export function getRedemptionRewardCopy(reward: MemberRedemptionReward) {
  return redemptionRewardCopy[reward.key] ?? reward;
}

export function getRecommendationTypeLabel(type: PersonalizedRecommendation["type"]) {
  return recommendationTypeLabels[type];
}

export function getRecommendationReasonLabel(reasonCode: string) {
  return reasonCodeLabels[reasonCode] ?? reasonCode;
}

export function getRecommendationCopy(
  recommendation: PersonalizedRecommendation,
  tasks: GrowthTask[]
) {
  if (recommendation.type === "growth_task") {
    const task = tasks.find((item) => item.key === recommendation.targetId);
    const copy = getGrowthTaskCopy(
      task ?? {
        key: recommendation.targetId,
        title: recommendation.title,
        description: recommendation.description
      }
    );
    return {
      title: copy.title,
      description: task
        ? `${copy.description} 完成后可获得 ${task.points} 成长积分。`
        : copy.description
    };
  }

  return {
    title: recommendation.type === "product"
      ? getProductTitleLabel(recommendation.title)
      : recommendation.title,
    description: recommendation.description
  };
}

export function getOrderStatusLabel(status: string) {
  return {
    created: "待支付",
    paid: "已支付",
    shipped: "已发货",
    delivered: "已签收",
    cancelled: "已取消",
    refunded: "已退款",
    partially_refunded: "部分退款"
  }[status] ?? status;
}

export function getReviewStatusLabel(status: string) {
  return { pending: "待审核", visible: "已展示", hidden: "已隐藏" }[status] ?? status;
}
