import type {
  CloudPetProfile,
  CloudPetRecommendation,
  CommunityPost
} from "../cloud-pets/cloud-pets-api";
import type { OrderResponse, ProductReview } from "../shop/shop-api";

export interface MemberProfile {
  member: {
    phone: string;
    name: string;
    tier: "bronze" | "silver" | "gold";
    points: number;
  };
  loyalty: MemberLoyaltyProfile;
  pets: CloudPetProfile[];
  orders: OrderResponse[];
  addresses: MemberAddress[];
  defaultAddress: MemberAddress | null;
  reviews: ProductReview[];
  communityEngagement: {
    likedPostCount: number;
    commentCount: number;
    followingPetCount: number;
    reportCount: number;
  };
  communityPosts: CommunityPost[];
  recommendations: CloudPetRecommendation[];
  personalizedRecommendations: PersonalizedRecommendation[];
  personalizationSummary: PersonalizationSummary;
  growthTasks: GrowthTask[];
  taskActivity: MemberTaskActivity;
  notifications: MemberNotification[];
  commercePlan: MemberCommercePlan;
}

export type PersonalizedRecommendationType = "product" | "growth_task" | "content";

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

export interface MemberNotification {
  id: string;
  type:
    | "coupon_available"
    | "growth_task_completed"
    | "order_created"
    | "shipment_delivered"
    | "review_request"
    | "review_pending";
  title: string;
  body: string;
  sourceId: string;
  actionHref: string;
  createdAt: string;
  read: boolean;
}

export interface MemberLoyaltyProfile {
  summary: {
    tier: "bronze" | "silver" | "gold";
    tierLabel: string;
    lifetimePoints: number;
    availablePoints: number;
    nextTier: "silver" | "gold" | null;
    pointsToNextTier: number;
    progressPercent: number;
  };
  ledger: Array<{
    eventType:
      | "order_purchase"
      | "growth_task"
      | "community_post"
      | "pet_bond"
      | "points_redemption";
    sourceId: string;
    points: number;
    description: string;
    createdAt: string;
  }>;
  redemptionRewards: MemberRedemptionReward[];
  redemptions: MemberRedemption[];
  rules: Array<{
    eventType:
      | "order_purchase"
      | "growth_task"
      | "community_post"
      | "pet_bond"
      | "points_redemption";
    title: string;
    description: string;
  }>;
}

export interface MemberRedemptionReward {
  key: string;
  title: string;
  description: string;
  pointsCost: number;
  couponCode: string;
  discountCents: number;
  minSpendCents: number;
}

export interface MemberRedemption {
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

export interface RedeemMemberPointsInput {
  rewardKey: string;
}

export interface MemberCommercePlan {
  tierProgress: {
    currentTier: "bronze" | "silver" | "gold";
    nextTier: "silver" | "gold" | null;
    pointsToNextTier: number;
    progressPercent: number;
  };
  benefits: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
    couponCode?: string;
    discountCents?: number;
    unlocked: boolean;
  }>;
  nextBestActions: Array<{
    key: string;
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
  }>;
}

export interface MemberTaskActivity {
  totalCompletedTasks: number;
  activeDays: number;
  currentStreakDays: number;
  longestStreakDays: number;
  nextMilestone: {
    targetDays: number;
    remainingDays: number;
    label: string;
  };
  calendar: Array<{
    date: string;
    completedCount: number;
    taskKeys: string[];
  }>;
}

export interface GrowthTask {
  key: string;
  title: string;
  description: string;
  points: number;
  rewards: {
    mood: number;
    energy: number;
    intimacy: number;
  };
}

export interface GrowthTaskCompletion {
  completedTask: GrowthTask;
  pet: CloudPetProfile;
  nextActions: Array<{
    key: "open-homepage" | "share-community" | "shop-reward" | "continue-care";
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
  }>;
}

export interface MemberLoginInput {
  name: string;
  phone: string;
}

export interface MemberLoginResponse {
  sessionToken: string;
  member: {
    phone: string;
    name: string;
  };
}

export interface MemberAddress {
  addressNo: string;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CreateMemberAddressInput {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault?: boolean;
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export function getMemberProfile(phone: string, fetcher: Fetcher = fetch) {
  return requestJson<MemberProfile>(
    `/members/${encodeURIComponent(phone)}`,
    { cache: "no-store" },
    fetcher
  );
}

export function getCurrentMemberProfile(
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<MemberProfile>(
    "/members/me",
    {
      cache: "no-store",
      headers: {
        "X-Member-Token": sessionToken
      }
    },
    fetcher
  );
}

export function loginMember(input: MemberLoginInput, fetcher: Fetcher = fetch) {
  return requestJson<MemberLoginResponse>(
    "/auth/login",
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    },
    fetcher
  );
}

export function createMemberAddress(
  phone: string,
  input: CreateMemberAddressInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<MemberAddress>(
    `/members/${encodeURIComponent(phone)}/addresses`,
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    },
    fetcher
  );
}

export function redeemMemberPoints(
  phone: string,
  input: RedeemMemberPointsInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<MemberRedemption>(
    `/members/${encodeURIComponent(phone)}/points/redemptions`,
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    },
    fetcher
  );
}

export function completeGrowthTask(
  petNo: string,
  taskKey: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<GrowthTaskCompletion>(
    `/cloud-pets/${encodeURIComponent(petNo)}/growth-tasks/${encodeURIComponent(
      taskKey
    )}/complete`,
    {
      cache: "no-store",
      method: "POST"
    },
    fetcher
  );
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fetcher: Fetcher
): Promise<T> {
  const response = await fetcher(`${API_BASE_URL}${path}`, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload as T;
}

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "Request failed";
}
