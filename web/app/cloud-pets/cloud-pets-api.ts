export interface CloudPetStats {
  mood: number;
  energy: number;
  intimacy: number;
}

export type CloudPetCareState = "needs_care" | "steady" | "thriving";
export type CloudPetHomepageTheme = "sunny" | "forest" | "midnight";

export interface CloudPetGrowthProfile {
  level: number;
  levelLabel: string;
  experiencePoints: number;
  nextLevelExperience: number;
  progressPercent: number;
  careState: CloudPetCareState;
  careScore: number;
  todayCompletedTaskCount: number;
  todayCompletedTaskKeys: string[];
  isCareCompleteToday: boolean;
  careStreakDays: number;
  lastCareDate?: string;
  nextCarePrompt: string;
}

export interface CloudPetHomepageProfile {
  theme: CloudPetHomepageTheme;
  headline: string;
  ownerStory: string;
  showGrowthArchive: boolean;
  showMallRecommendations: boolean;
}

export interface CloudPetHomepageArchive {
  petNo: string;
  share: {
    title: string;
    description: string;
    url: string;
    ctaLabel: string;
  };
  commerceReward: {
    status: "locked" | "unlocked";
    title: string;
    description: string;
    couponCode?: string;
    discountCents?: number;
    ctaHref: string;
    ctaLabel: string;
    recommendedProductSlug?: string;
    recommendedProductTitle?: string;
  };
  engagement: {
    homepageVisitCount: number;
  };
  filters: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  items: CloudPetEvent[];
}

export interface CloudPetEvent {
  id?: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CloudPetProfile {
  petNo: string;
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
  avatarUrl: string;
  bio: string;
  stats: CloudPetStats;
  growth: CloudPetGrowthProfile;
  homepage: CloudPetHomepageProfile;
  timeline: CloudPetEvent[];
}

export type CloudPetPublicProfile = Omit<
  CloudPetProfile,
  "ownerName" | "ownerPhone"
>;

export interface CreateCloudPetInput {
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
}

export interface UpdateCloudPetHomepageInput {
  theme?: CloudPetHomepageTheme;
  headline?: string;
  ownerStory?: string;
  showGrowthArchive?: boolean;
  showMallRecommendations?: boolean;
}

export interface CreateCloudPetDiaryNoteInput {
  title?: string;
  body: string;
}

export interface RecordCloudPetHomepageVisitInput {
  visitorId: string;
  source?: string;
}

export interface CloudPetHomepageVisitRecord {
  petNo: string;
  source: string;
  visitCount: number;
  createdAt: string;
}

export interface CommunityPost {
  postNo: string;
  petNo: string;
  petName: string;
  authorName: string;
  body: string;
  status: "visible" | "hidden";
  likeCount: number;
  commentCount: number;
  reportCount: number;
  authorDeletedAt?: string;
  createdAt: string;
  commerceBridge?: {
    ctaHref: string;
    ctaLabel: string;
    reason: string;
    recommendedProduct?: {
      slug: string;
      title: string;
      petType: "cat" | "dog" | "both";
      priceCents: number;
    };
  };
}

export interface CreateCommunityPostInput {
  petNo: string;
  authorName: string;
  body: string;
}

export interface CommunityComment {
  commentNo: string;
  postNo: string;
  memberPhone?: string;
  authorName: string;
  body: string;
  status: "visible" | "hidden";
  createdAt: string;
}

export interface CommunityReport {
  reportNo: string;
  postNo: string;
  memberPhone?: string;
  reporterName: string;
  reason: string;
  status: "pending_review" | "reviewed" | "dismissed";
  note?: string;
  createdAt: string;
  resolvedAt?: string;
  created?: boolean;
}

export interface CloudPetRecommendation {
  id: string;
  slug: string;
  title: string;
  petType: "cat" | "dog" | "both";
  toyType: string;
  priceCents: number;
  coverImageUrl: string;
  status: "active" | "draft" | "archived";
  reason: string;
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export function createCloudPet(
  input: CreateCloudPetInput,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    "/cloud-pets",
    jsonRequest(input, sessionToken),
    fetcher
  );
}

export function getCloudPet(petNo: string, fetcher: Fetcher = fetch) {
  return requestJson<CloudPetPublicProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}`,
    { cache: "no-store" },
    fetcher
  );
}

export function createCloudPetDiaryNote(
  petNo: string,
  input: CreateCloudPetDiaryNoteInput,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}/diary-notes`,
    jsonRequest(input, sessionToken),
    fetcher
  );
}
export function updateCloudPetDiaryNote(
  petNo: string,
  noteId: string,
  input: CreateCloudPetDiaryNoteInput,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}/diary-notes/${encodeURIComponent(noteId)}`,
    { ...jsonRequest(input, sessionToken), method: "PATCH" },
    fetcher
  );
}

export function deleteCloudPetDiaryNote(
  petNo: string,
  noteId: string,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}/diary-notes/${encodeURIComponent(noteId)}`,
    {
      cache: "no-store",
      headers: { "X-Member-Token": sessionToken },
      method: "DELETE"
    },
    fetcher
  );
}
export function updateCloudPetHomepage(
  petNo: string,
  input: UpdateCloudPetHomepageInput,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}/homepage`,
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Member-Token": sessionToken
      },
      method: "PATCH"
    },
    fetcher
  );
}
export function getCloudPetHomepageArchive(
  petNo: string,
  input: { eventType?: string } = {},
  fetcher: Fetcher = fetch
) {
  const params = new URLSearchParams();

  if (input.eventType) {
    params.set("eventType", input.eventType);
  }

  const queryString = params.toString();

  return requestJson<CloudPetHomepageArchive>(
    `/cloud-pets/${encodeURIComponent(petNo)}/homepage/archive${
      queryString ? `?${queryString}` : ""
    }`,
    { cache: "no-store" },
    fetcher
  );
}

export function recordCloudPetHomepageVisit(
  petNo: string,
  input: RecordCloudPetHomepageVisitInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetHomepageVisitRecord>(
    `/cloud-pets/${encodeURIComponent(petNo)}/homepage/visits`,
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
}

export async function listCommunityPosts(fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: CommunityPost[] }>(
    "/community/posts",
    { cache: "no-store" },
    fetcher
  );

  return response.items;
}

export async function listFollowedCommunityPosts(
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: CommunityPost[] }>(
    "/community/posts/following",
    memberRequest(sessionToken),
    fetcher
  );

  return response.items;
}

export function createCommunityPost(
  input: CreateCommunityPostInput,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityPost>(
    "/community/posts",
    jsonRequest(input, sessionToken),
    fetcher
  );
}

export function withdrawCommunityPost(
  postNo: string,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityPost>(
    `/community/posts/${encodeURIComponent(postNo)}`,
    {
      cache: "no-store",
      headers: { "X-Member-Token": sessionToken },
      method: "DELETE"
    },
    fetcher
  );
}

export function likeCommunityPost(
  postNo: string,
  input: { memberPhone?: string; authorName?: string },
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<{ postNo: string; liked: true; likeCount: number }>(
    `/community/posts/${encodeURIComponent(postNo)}/likes`,
    jsonRequest(input, sessionToken),
    fetcher
  );
}

export async function listCommunityComments(
  postNo: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: CommunityComment[] }>(
    `/community/posts/${encodeURIComponent(postNo)}/comments`,
    { cache: "no-store" },
    fetcher
  );

  return response.items;
}

export function commentOnCommunityPost(
  postNo: string,
  input: { memberPhone?: string; authorName?: string; body: string },
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityComment>(
    `/community/posts/${encodeURIComponent(postNo)}/comments`,
    jsonRequest(input, sessionToken),
    fetcher
  );
}

export function followCloudPet(
  petNo: string,
  input: { followerPhone?: string; followerName?: string },
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<{
    petNo: string;
    followerPhone: string;
    following: true;
    created: boolean;
    followerCount: number;
  }>(
    `/community/pets/${encodeURIComponent(petNo)}/follows`,
    jsonRequest(input, sessionToken),
    fetcher
  );
}

export function reportCommunityPost(
  postNo: string,
  input: { memberPhone?: string; reporterName?: string; reason: string },
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityReport>(
    `/community/posts/${encodeURIComponent(postNo)}/reports`,
    jsonRequest(input, sessionToken),
    fetcher
  );
}
export async function getCloudPetRecommendations(
  petNo: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: CloudPetRecommendation[] }>(
    `/cloud-pets/${encodeURIComponent(petNo)}/recommendations`,
    { cache: "no-store" },
    fetcher
  );

  return response.items;
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

function memberRequest(sessionToken: string): RequestInit {
  return {
    cache: "no-store",
    headers: { "X-Member-Token": sessionToken }
  };
}

function jsonRequest(body: unknown, sessionToken?: string): RequestInit {
  return {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: sessionToken
      ? { "Content-Type": "application/json", "X-Member-Token": sessionToken }
      : { "Content-Type": "application/json" },
    method: "POST"
  };
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

  return "请求失败";
}
