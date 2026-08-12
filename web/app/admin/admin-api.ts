import type {
  CmsBlock,
  CmsBlockStatus,
  CreateCmsBlockInput,
  UpdateCmsBlockStatusInput
} from "../cms-content-api";
import type {
  CloudPetHomepageArchive,
  CloudPetProfile,
  CommunityPost,
  CommunityReport
} from "../cloud-pets/cloud-pets-api";
import type {
  OrderResponse,
  ShipmentStatus,
  ProductReview,
  ProductReviewStatus,
  ShopProductDetail
} from "../shop/shop-api";

export interface AdminDashboardMetrics {
  activeProductCount: number;
  cloudPetCount: number;
  dailyDiaryCoveredCount: number;
  dailyDiaryMissingCount: number;
  dailyDiaryCoverageRate: number;
  communityPostCount: number;
  hiddenCommunityPostCount: number;
  lowStockVariantCount: number;
  orderCount: number;
  pendingOrderCount: number;
  pendingRefundCount: number;
  expeditedRefundCount: number;
  blockedRefundCount: number;
  dueSoonRefundCount: number;
  overdueRefundCount: number;
  pendingRefundAmountCents: number;
  paymentIntentCount: number;
  pendingPaymentIntentCount: number;
  failedPaymentIntentCount: number;
  overduePaymentIntentCount: number;
  operationLogCount: number;
  highRiskOperationCount: number;
  permissionDeniedCount: number;
  memberVerificationIssuedCount: number;
  memberVerificationSuccessCount: number;
  memberVerificationActiveCount: number;
  memberVerificationExpiredCount: number;
  memberVerificationLockedCount: number;
  memberVerificationFailedAttemptCount: number;
  memberVerificationSuccessRate: number;
  pendingCommunityReportCount?: number;
}

export interface AdminCloudPetOpsHealth {
  timestamp: string;
  status: "healthy" | "critical";
  reasons: string[];
  readiness: { ready: boolean };
  http: {
    scope: "process";
    windowSeconds: number;
    requestCount: number;
    serverErrorCount: number;
    serverErrorRate: number;
    rateLimitedCount: number;
  };
  cloudPet: {
    dailyDiary: {
      date: string;
      coveredCount: number;
      missingCount: number;
      coverageRate: number;
    } | null;
    communityModeration: { openReportCount: number } | null;
  };
}

export interface AdminDeploymentReadiness {
  status: "ready" | "attention";
  runtime: {
    production: boolean;
  };
  persistence: {
    mode: "prisma_sqlite" | "memory" | "unknown";
    databaseReady: boolean;
  };
  configuration: {
    adminAuthConfigured: boolean;
    memberWebhookConfigured: boolean;
    corsConfigured: boolean;
    trustedProxyConfigured: boolean;
    requestBodyLimitConfigured: boolean;
    opsMetricsConfigured: boolean;
    recoveryStatusDirectoryConfigured: boolean;
  };
  configBaseline: {
    status: "matched" | "unconfigured" | "mismatch";
  };
  release: {
    status: "identified" | "unidentified";
    id: string | null;
  };
  migrationCompatibility: {
    status: "compatible" | "mismatch" | "unavailable";
  };
}

export type AdminCloudPetLaunchReadinessAttentionCode =
  | "API_NOT_READY"
  | "CONFIG_BASELINE_UNCONFIGURED"
  | "CONFIG_BASELINE_MISMATCH"
  | "RELEASE_ID_UNCONFIGURED"
  | "DATABASE_MIGRATION_NOT_READY"
  | "RUNTIME_CRITICAL"
  | "RECOVERY_NOT_VERIFIED"
  | "BACKUP_STALE"
  | "AUTO_RECOVERY_SUPPRESSED";

export interface AdminCloudPetLaunchReadiness {
  checkedAt: string;
  status: "passed" | "needs_attention";
  checks: {
    runtime: "passed" | "failed";
    dataProtection: "passed" | "failed";
    automation: "passed" | "attention";
  };
  attentionItems: Array<{
    code: AdminCloudPetLaunchReadinessAttentionCode;
  }>;
}

export interface AdminSqliteRecoveryStatus {
  autoRefreshEnabled: boolean;
  autoRefreshRuntime: {
    lastCheckedAt: string | null;
    lastOutcome:
      | "not_run_yet"
      | "run_succeeded"
      | "skipped_fresh"
      | "skipped_ineligible"
      | "skipped_busy"
      | "skipped_suppressed"
      | "run_failed";
    reasonCode: string | null;
    suppressionActive: boolean;
    nextCheckAt: string | null;
  };
  status:
    | "no_backup"
    | "backup_unverified"
    | "recoverable"
    | "drill_failed"
    | "unavailable";
  freshness: "fresh" | "stale" | "unknown";
  maxBackupAgeHours?: number;
  latestBackup?: {
    createdAt: string;
    ageSeconds: number;
  };
  latestRestoreDrill?: {
    checkedAt: string;
    status: "passed" | "failed";
    failureCode?: string;
  };
}

export interface AdminSqliteRecoveryRunResult {
  ok: true;
  status: AdminSqliteRecoveryStatus["status"];
  freshness: AdminSqliteRecoveryStatus["freshness"];
  completedAt: string;
}

export interface MerchantAnalytics {
  revenue: {
    gmvCents: number;
    paidOrderCount: number;
    averageOrderValueCents: number;
  };
  conversion: {
    orderCount: number;
    paidOrderRate: number;
    statusBreakdown: Record<string, number>;
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
  customerSegments: Array<{
    key: string;
    title: string;
    description: string;
    memberCount: number;
    samplePhones: string[];
    actionLabel: string;
    priority: "high" | "medium" | "low";
  }>;
  retentionFunnel: Array<{
    key: string;
    title: string;
    count: number;
    conversionRate: number;
    dropOffCount: number;
    actionLabel: string;
  }>;
  retentionSignals: {
    cloudPetCount: number;
    homepageVisitCount: number;
    communityPostCount: number;
    reviewCount: number;
    pendingReviewCount: number;
    pendingCommunityReportCount: number;
  };
}

export type AdminPermission =
  | "audit:read"
  | "catalog:write"
  | "customers:write"
  | "cms:write"
  | "cloud_pets:write"
  | "community:moderate"
  | "fulfillment:write"
  | "marketing:write"
  | "reviews:moderate"
  | "refunds:write";

export interface AdminStaffProfile {
  staffNo: string;
  name: string;
  role: "owner" | "operator";
  permissions: AdminPermission[];
}

export interface OperationLogRecord {
  logNo: string;
  staffNo: string;
  staffName: string;
  role: "owner" | "operator";
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export type AdminPaymentProvider = "mock_wechat" | "mock_alipay";
export type AdminPaymentFailureCode =
  | "INSUFFICIENT_BALANCE"
  | "PAYMENT_DECLINED"
  | "PROVIDER_UNAVAILABLE"
  | "USER_CANCELLED_PAYMENT"
  | "UNKNOWN_PROVIDER_ERROR";
export type AdminPaymentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export interface AdminPaymentIntent {
  id: string;
  orderId: string;
  memberId: string;
  amount: number;
  currency: "CNY";
  provider: AdminPaymentProvider;
  status: AdminPaymentStatus;
  providerTradeNo?: string;
  idempotencyKey: string;
  payUrl: string;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  expiresAt?: string;
  expiredAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  failureCode?: AdminPaymentFailureCode;
  failureMessage?: string;
  failedAt?: string;
  attemptNo: number;
  previousPaymentIntentId?: string;
  remainingSeconds?: number;
  orderStatus: OrderResponse["status"];
  orderCloseReason?: string;
  orderMemberCancelReason?: string;
  orderMemberCancelNote?: string;
  canRetry?: boolean;
}

export interface AdminPaymentLedgerEntry {
  id: string;
  orderId: string;
  paymentIntentId: string;
  memberId: string;
  type: "payment";
  direction: "credit";
  amount: number;
  currency: "CNY";
  provider: AdminPaymentProvider;
  status: "pending" | "success" | "failed";
  providerTradeNo?: string;
  eventType: "payment_created" | "payment_confirmed" | "payment_failed" | "payment_expired" | "payment_cancelled";
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AdminPaymentDetail {
  paymentIntent: AdminPaymentIntent;
  ledger: AdminPaymentLedgerEntry[];
  relatedIntents?: AdminPaymentIntent[];
}
export interface ExpireOverduePaymentsResult {
  scannedCount: number;
  expiredIntentCount: number;
  closedOrderCount: number;
  inventoryReleasedCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    paymentIntentId: string;
    orderId: string;
    status: "expired" | "skipped" | "failed";
    reason?: string;
  }>;
}

export interface AdminCloudPet extends CloudPetProfile {
  communityPostCount: number;
  homepageVisitCount: number;
}

export interface AdminCloudPetFilters {
  q?: string;
  species?: "cat" | "dog";
  careState?: "needs_care" | "steady" | "thriving";
}

export interface AdminCloudPetOperationalDetail {
  pet: AdminCloudPet;
  archive: CloudPetHomepageArchive;
  community: {
    posts: CommunityPost[];
    postCount: number;
    likeCount: number;
    commentCount: number;
    reportCount: number;
    pendingReportCount: number;
    pendingReportPostNos: string[];
  };
  diary: {
    entryCount: number;
    latestEntry?: CloudPetProfile["timeline"][number];
    latestOwnerNote?: CloudPetProfile["timeline"][number];
  };
}

export interface AdminCloudPetRetentionMetrics {
  date: string;
  totalPetCount: number;
  careCompletedTodayCount: number;
  careCompletionRate: number;
  averageCareScore: number;
  maxCareStreakDays: number;
  careStateCounts: {
    needsCare: number;
    steady: number;
    thriving: number;
  };
  dailyDiaryCoveredCount: number;
  dailyDiaryMissingCount: number;
  dailyDiaryCoverageRate: number;
  homepageVisitCount: number;
  communityPostCount: number;
  pendingCommunityReportCount: number;
}

export interface AdminCloudPetGrowthTaskOperations {
  totalPetCount: number;
  items: Array<{
    key: string;
    title: string;
    description: string;
    points: number;
    rewards: {
      mood: number;
      energy: number;
      intimacy: number;
    };
    completedTodayCount: number;
    completionRate: number;
  }>;
}

export interface UpdateAdminCloudPetGrowthTaskInput {
  title?: string;
  description?: string;
  points?: number;
  rewards?: {
    mood?: number;
    energy?: number;
    intimacy?: number;
  };
}

export interface AdminCloudPetCareScoreRules {
  dailyTaskBonus: number;
  steadyMinScore: number;
  thrivingMinScore: number;
  thrivingRequiresCareToday: boolean;
  updatedAt?: string;
}

export interface UpdateAdminCloudPetCareScoreRulesInput {
  dailyTaskBonus?: number;
  steadyMinScore?: number;
  thrivingMinScore?: number;
  thrivingRequiresCareToday?: boolean;
}

export interface CloudPetDailyDiaryGenerationResult {
  date: string;
  generatedCount: number;
  skippedCount: number;
  items: Array<{
    petNo: string;
    name: string;
    status: "generated" | "skipped";
    reason: string;
    event?: CloudPetProfile["timeline"][number];
  }>;
}

export interface CloudPetDailyDiaryStatusResult {
  date: string;
  totalPetCount: number;
  generatedTodayCount: number;
  missingTodayCount: number;
  coverageRate: number;
  items: Array<{
    petNo: string;
    name: string;
    status: "covered" | "missing";
    latestDailyDiaryAt?: string;
  }>;
}

export interface CloudPetDailyDiaryCoverageMissingPet {
  petId: string;
  petNo: string;
  petName: string;
  memberId: string;
  memberPhone: string;
  growthLevel: number;
  careState: "needs_care" | "steady" | "thriving";
  lastDiaryDate?: string;
  reason: "NO_TASK_COMPLETED" | "NO_DIARY_GENERATED";
}

export interface CloudPetDailyDiaryCoverageResult {
  date: string;
  coveredCount: number;
  missingCount: number;
  coverageRate: number;
  missingPets: CloudPetDailyDiaryCoverageMissingPet[];
}

export interface CloudPetDailyDiaryBackfillInput {
  date: string;
  mode: "missingOnly" | "selected";
  petIds?: string[];
}

export interface CloudPetDailyDiaryBackfillResult {
  date: string;
  mode: "missingOnly" | "selected";
  attemptedCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: Array<{
    petId: string;
    petNo?: string;
    petName?: string;
    status: "created" | "skipped" | "failed";
    diaryId?: string;
    reason?:
      | "ALREADY_HAS_DIARY"
      | "NOT_MISSING"
      | "PET_NOT_FOUND"
      | "NO_TASK_COMPLETED"
      | "NO_DIARY_GENERATED"
      | "GENERATION_FAILED"
      | "INVALID_SELECTED_PET"
      | "UNKNOWN";
  }>;
}

export type CommunityModerationStatus = "visible" | "hidden";
export type CommunityReportStatus = "pending_review" | "reviewed" | "dismissed";
export type ProductStatus = "active" | "draft" | "archived";
export type CouponStatus = "active" | "paused" | "archived";

export interface CouponCampaign {
  code: string;
  title: string;
  description?: string;
  status: CouponStatus;
  discountType: "fixed_amount";
  discountValueCents: number;
  minSpendCents: number;
  usageLimitPerMember?: number;
  startsAt?: string;
  endsAt?: string;
  usageCount: number;
}

export type RefundStatus = "pending_review" | "approved" | "rejected";

export interface RefundReviewRisk {
  level: "low" | "medium" | "high";
  priority: "normal" | "expedite" | "blocked";
  reason: string;
}

export interface RefundReviewSla {
  policyHours: number;
  dueAt: string;
  hoursUntilDue: number;
  status: "on_track" | "due_soon" | "overdue";
}

export interface RefundRequestRecord {
  refundNo: string;
  orderNo: string;
  customerPhone: string;
  reason: string;
  status: RefundStatus;
  requestedAmountCents: number;
  refundedAmountCents?: number;
  note?: string;
  createdAt: string;
  resolvedAt?: string;
  refundableBalanceCents?: number;
  remainingAfterRequestCents?: number;
  reviewRisk?: RefundReviewRisk;
  reviewSla?: RefundReviewSla;
}

export type AdminProductReview = ProductReview;
export type AdminCommunityReport = CommunityReport;
export interface AdminCommunityReportFilters {
  status?: CommunityReportStatus;
  postNo?: string;
  commentNo?: string;
  memberPhone?: string;
}
export type AdminCmsBlock = CmsBlock;
export type AdminCmsBlockStatus = CmsBlockStatus;
export type AdminCreateCmsBlockInput = CreateCmsBlockInput;
export type AdminUpdateCmsBlockStatusInput = UpdateCmsBlockStatusInput;

export interface AdminCustomerListItem {
  phone: string;
  name: string;
  paidOrderCount: number;
  totalPaidCents: number;
  petCount: number;
  communityPostCount: number;
  tags: string[];
  nextBestAction: {
    key: string;
    title: string;
    ctaLabel: string;
  };
}

export interface AdminCustomerProfile extends AdminCustomerListItem {
  summary: {
    orderCount: number;
    paidOrderCount: number;
    pendingOrderCount: number;
    totalPaidCents: number;
    petCount: number;
    homepageVisitCount: number;
    communityPostCount: number;
    reviewCount: number;
  };
  segmentKeys: string[];
  crm: {
    tags: string[];
    note?: string;
    ownerStaffName?: string;
    followUps: Array<{
      followUpNo: string;
      type: "call" | "wechat" | "note";
      summary: string;
      createdAt: string;
      nextActionAt?: string;
    }>;
  };
  orders: OrderResponse[];
  pets: AdminCloudPet[];
  communityPosts: CommunityPost[];
  reviews: ProductReview[];
}

export interface UpdateCustomerCrmInput {
  tags?: string[];
  note?: string;
  ownerStaffName?: string;
}

export interface CreateCustomerFollowUpInput {
  type: "call" | "wechat" | "note";
  summary: string;
  nextActionAt?: string;
}

export interface CreateAdminProductInput {
  slug: string;
  title: string;
  description: string;
  petType: "cat" | "dog" | "both";
  toyType: string;
  status: ProductStatus;
  images: string[];
  variants: Array<{
    skuCode: string;
    name: string;
    color?: string;
    size?: string;
    material?: string;
    priceCents: number;
    compareAtCents?: number;
    stock: number;
  }>;
}

export interface LowStockVariant {
  productSlug: string;
  productTitle: string;
  skuCode: string;
  variantName: string;
  stock: number;
  threshold: number;
  isAvailable: boolean;
}

export interface FulfillmentInput {
  carrier: string;
  trackingNumber: string;
}

export interface FulfillmentResponse {
  orderNo: string;
  status: "shipped";
  shipment: NonNullable<OrderResponse["shipment"]>;
}

export interface ShipmentEventInput {
  status: Exclude<ShipmentStatus, "created">;
  location: string;
  description: string;
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export interface AdminLoginInput {
  email: string;
  password: string;
}

export interface AdminLoginResult {
  sessionToken: string;
  staff: AdminStaffProfile;
}

export function adminLogin(
  input: AdminLoginInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminLoginResult>(
    "/admin/auth/login",
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

export function adminLogout(
  credential = getStoredAdminSession(),
  fetcher: Fetcher = fetch
) {
  return requestJson<{ success: true }>(
    "/admin/auth/logout",
    jsonAdminRequest(credential, {}, "POST"),
    fetcher
  );
}

export function getAdminMe(
  credential = getStoredAdminSession(),
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminStaffProfile>(
    "/admin/auth/me",
    adminRequest(credential),
    fetcher
  );
}

export function getAdminDashboard(token: string, fetcher: Fetcher = fetch) {
  return requestJson<AdminDashboardMetrics>(
    "/admin/dashboard",
    adminRequest(token),
    fetcher
  );
}

export function getMerchantAnalytics(token: string, fetcher: Fetcher = fetch) {
  return requestJson<MerchantAnalytics>(
    "/admin/analytics",
    adminRequest(token),
    fetcher
  );
}

export function getCurrentAdminStaff(token: string, fetcher: Fetcher = fetch) {
  return requestJson<AdminStaffProfile>(
    "/admin/staff/me",
    adminRequest(token),
    fetcher
  );
}

export async function listAdminCmsBlocks(
  token: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: AdminCmsBlock[] }>(
    "/admin/cms/blocks",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function createCmsBlock(
  input: AdminCreateCmsBlockInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCmsBlock>(
    "/admin/cms/blocks",
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export function updateCmsBlockStatus(
  blockNo: string,
  status: AdminCmsBlockStatus,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCmsBlock>(
    `/admin/cms/blocks/${encodeURIComponent(blockNo)}/status`,
    jsonAdminRequest(token, { status }, "PATCH"),
    fetcher
  );
}

export async function listOperationLogs(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: OperationLogRecord[] }>(
    "/admin/operation-logs",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminCustomers(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: AdminCustomerListItem[] }>(
    "/admin/customers",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function getAdminCustomer(
  phone: string,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCustomerProfile>(
    `/admin/customers/${encodeURIComponent(phone)}`,
    adminRequest(token),
    fetcher
  );
}

export function updateCustomerCrm(
  phone: string,
  input: UpdateCustomerCrmInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCustomerProfile>(
    `/admin/customers/${encodeURIComponent(phone)}/crm`,
    jsonAdminRequest(token, input, "PATCH"),
    fetcher
  );
}

export function createCustomerFollowUp(
  phone: string,
  input: CreateCustomerFollowUpInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCustomerProfile["crm"]["followUps"][number]>(
    `/admin/customers/${encodeURIComponent(phone)}/follow-ups`,
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export async function listAdminCloudPets(
  token: string,
  filtersOrFetcher: AdminCloudPetFilters | Fetcher = {},
  maybeFetcher?: Fetcher
) {
  const filters = typeof filtersOrFetcher === "function" ? {} : filtersOrFetcher;
  const fetcher = typeof filtersOrFetcher === "function" ? filtersOrFetcher : maybeFetcher ?? fetch;
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.species) {
    params.set("species", filters.species);
  }

  if (filters.careState) {
    params.set("careState", filters.careState);
  }

  const query = params.toString();
  const response = await requestJson<{ items: AdminCloudPet[] }>(
    `/admin/cloud-pets${query ? `?${query}` : ""}`,
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function getAdminCloudPetRetentionMetrics(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetRetentionMetrics>(
    "/admin/cloud-pets/retention-metrics",
    adminRequest(token),
    fetcher
  );
}

export function getCloudPetOpsHealth(token: string, fetcher: Fetcher = fetch) {
  return requestJson<AdminCloudPetOpsHealth>(
    "/admin/ops/cloud-pet-health",
    adminRequest(token),
    fetcher
  );
}

export function getAdminDeploymentReadiness(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminDeploymentReadiness>(
    "/admin/ops/deployment-readiness",
    adminRequest(token),
    fetcher
  );
}

export function getAdminCloudPetLaunchReadiness(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetLaunchReadiness>(
    "/admin/ops/cloud-pet-launch-readiness",
    adminRequest(token),
    fetcher
  );
}

export function getAdminSqliteRecoveryStatus(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminSqliteRecoveryStatus>(
    "/admin/ops/sqlite-recovery-status",
    adminRequest(token),
    fetcher
  );
}

export function runAdminSqliteRecovery(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminSqliteRecoveryRunResult>(
    "/admin/ops/sqlite-recovery/run",
    jsonAdminRequest(token, {}, "POST"),
    fetcher
  );
}

export function getAdminCloudPetGrowthTaskOperations(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetGrowthTaskOperations>(
    "/admin/cloud-pets/growth-tasks",
    adminRequest(token),
    fetcher
  );
}

export function updateAdminCloudPetGrowthTask(
  token: string,
  taskKey: string,
  input: UpdateAdminCloudPetGrowthTaskInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetGrowthTaskOperations["items"][number]>(
    `/admin/cloud-pets/growth-tasks/${encodeURIComponent(taskKey)}`,
    jsonAdminRequest(token, input, "PATCH"),
    fetcher
  );
}

export function getAdminCloudPetCareScoreRules(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetCareScoreRules>(
    "/admin/cloud-pets/care-score-rules",
    adminRequest(token),
    fetcher
  );
}

export function updateAdminCloudPetCareScoreRules(
  token: string,
  input: UpdateAdminCloudPetCareScoreRulesInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetCareScoreRules>(
    "/admin/cloud-pets/care-score-rules",
    jsonAdminRequest(token, input, "PATCH"),
    fetcher
  );
}

export function removeAdminCloudPetDiaryNote(
  token: string,
  petNo: string,
  noteId: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPet>(
    `/admin/cloud-pets/${encodeURIComponent(petNo)}/diary-notes/${encodeURIComponent(noteId)}`,
    { ...adminRequest(token), method: "DELETE" },
    fetcher
  );
}

export function getAdminCloudPetDetail(
  token: string,
  petNo: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCloudPetOperationalDetail>(
    `/admin/cloud-pets/${encodeURIComponent(petNo)}/detail`,
    adminRequest(token),
    fetcher
  );
}

export function generateCloudPetDailyDiaries(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetDailyDiaryGenerationResult>(
    "/admin/cloud-pets/daily-diaries/generate",
    jsonAdminRequest(token, {}, "POST"),
    fetcher
  );
}

export function getCloudPetDailyDiaryStatus(
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetDailyDiaryStatusResult>(
    "/admin/cloud-pets/daily-diaries/status",
    adminRequest(token),
    fetcher
  );
}

export function getDailyDiaryCoverage(
  token: string,
  date: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetDailyDiaryCoverageResult>(
    `/admin/pets/daily-diary-coverage?date=${encodeURIComponent(date)}`,
    adminRequest(token),
    fetcher
  );
}

export function backfillDailyDiaryCoverage(
  token: string,
  input: CloudPetDailyDiaryBackfillInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetDailyDiaryBackfillResult>(
    "/admin/pets/daily-diary-coverage/backfill",
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export async function listAdminProducts(
  token: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: ShopProductDetail[] }>(
    "/admin/products",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function createAdminProduct(
  input: CreateAdminProductInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<ShopProductDetail>(
    "/admin/products",
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export async function listLowStockVariants(
  token: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: LowStockVariant[] }>(
    "/admin/inventory/low-stock",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminOrders(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: OrderResponse[] }>(
    "/admin/orders",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminPayments(
  token: string,
  filters: {
    orderId?: string;
    status?: AdminPaymentStatus;
    provider?: AdminPaymentProvider;
    overdue?: boolean;
    failureCode?: AdminPaymentFailureCode;
  } = {},
  fetcher: Fetcher = fetch
) {
  const params = new URLSearchParams();

  if (filters.orderId) {
    params.set("orderId", filters.orderId);
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.provider) {
    params.set("provider", filters.provider);
  }

  if (filters.overdue) {
    params.set("overdue", "true");
  }

  if (filters.failureCode) {
    params.set("failureCode", filters.failureCode);
  }

  const query = params.toString();
  const response = await requestJson<{ items: AdminPaymentIntent[] }>(
    `/admin/payments${query ? `?${query}` : ""}`,
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function expireOverduePayments(
  token: string,
  input: { limit?: number } = {},
  fetcher: Fetcher = fetch
) {
  return requestJson<ExpireOverduePaymentsResult>(
    "/admin/payments/expire-overdue",
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}
export function getAdminPayment(
  paymentIntentId: string,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminPaymentDetail>(
    `/admin/payments/${encodeURIComponent(paymentIntentId)}`,
    adminRequest(token),
    fetcher
  );
}

export async function listAdminCoupons(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: CouponCampaign[] }>(
    "/admin/coupons",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminRefunds(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: RefundRequestRecord[] }>(
    "/admin/refunds",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminReviews(token: string, fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: AdminProductReview[] }>(
    "/admin/reviews",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminCommunityPosts(
  token: string,
  fetcher: Fetcher = fetch
) {
  const response = await requestJson<{ items: CommunityPost[] }>(
    "/admin/community/posts",
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export async function listAdminCommunityReports(
  token: string,
  filtersOrFetcher: AdminCommunityReportFilters | Fetcher = {},
  maybeFetcher?: Fetcher
) {
  const filters = typeof filtersOrFetcher === "function" ? {} : filtersOrFetcher;
  const fetcher = typeof filtersOrFetcher === "function" ? filtersOrFetcher : maybeFetcher ?? fetch;
  const params = new URLSearchParams();

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.postNo?.trim()) {
    params.set("postNo", filters.postNo.trim());
  }

  if (filters.commentNo?.trim()) {
    params.set("commentNo", filters.commentNo.trim());
  }

  if (filters.memberPhone?.trim()) {
    params.set("memberPhone", filters.memberPhone.trim());
  }

  const query = params.toString();
  const response = await requestJson<{ items: AdminCommunityReport[] }>(
    `/admin/community/reports${query ? `?${query}` : ""}`,
    adminRequest(token),
    fetcher
  );

  return response.items;
}

export function updateCommunityPostStatus(
  postNo: string,
  status: CommunityModerationStatus,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityPost>(
    `/admin/community/posts/${encodeURIComponent(postNo)}/status`,
    {
      body: JSON.stringify({ status }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...buildAdminAuthHeader(token)
      },
      method: "PATCH"
    },
    fetcher
  );
}

export function updateCommunityReportStatus(
  reportNo: string,
  status: CommunityReportStatus,
  note: string,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminCommunityReport>(
    `/admin/community/reports/${encodeURIComponent(reportNo)}/status`,
    jsonAdminRequest(token, { status, note }, "PATCH"),
    fetcher
  );
}

export function updateProductStatus(
  slug: string,
  status: ProductStatus,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<ShopProductDetail>(
    `/admin/products/${encodeURIComponent(slug)}/status`,
    jsonAdminRequest(token, { status }, "PATCH"),
    fetcher
  );
}

export function updateVariantStock(
  skuCode: string,
  stock: number,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<ShopProductDetail["variants"][number]>(
    `/admin/products/variants/${encodeURIComponent(skuCode)}/stock`,
    jsonAdminRequest(token, { stock }, "PATCH"),
    fetcher
  );
}

export function fulfillOrder(
  orderNo: string,
  input: FulfillmentInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<FulfillmentResponse>(
    `/admin/orders/${encodeURIComponent(orderNo)}/shipments`,
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export function recordShipmentEvent(
  orderNo: string,
  input: ShipmentEventInput,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<OrderResponse>(
    `/admin/orders/${encodeURIComponent(orderNo)}/shipments/events`,
    jsonAdminRequest(token, input, "POST"),
    fetcher
  );
}

export function updateCouponStatus(
  code: string,
  status: CouponStatus,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<CouponCampaign>(
    `/admin/coupons/${encodeURIComponent(code)}/status`,
    jsonAdminRequest(token, { status }, "PATCH"),
    fetcher
  );
}

export function updateRefundStatus(
  refundNo: string,
  status: Exclude<RefundStatus, "pending_review">,
  note: string,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<RefundRequestRecord>(
    `/admin/refunds/${encodeURIComponent(refundNo)}/status`,
    jsonAdminRequest(token, { status, note }, "PATCH"),
    fetcher
  );
}

export function updateReviewStatus(
  reviewNo: string,
  status: ProductReviewStatus,
  token: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<AdminProductReview>(
    `/admin/reviews/${encodeURIComponent(reviewNo)}/status`,
    jsonAdminRequest(token, { status }, "PATCH"),
    fetcher
  );
}

function adminRequest(token: string): RequestInit {
  return {
    cache: "no-store",
    headers: buildAdminAuthHeader(token)
  };
}

function jsonAdminRequest(
  token: string,
  body: unknown,
  method: "PATCH" | "POST"
): RequestInit {
  return {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildAdminAuthHeader(token)
    },
    method
  };
}

function buildAdminAuthHeader(credential: string): Record<string, string> {
  if (credential.startsWith("admin_")) {
    return { "X-Admin-Session": credential };
  }

  return { "X-Admin-Token": credential };
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fetcher: Fetcher
): Promise<T> {
  const response = await fetcher(`${API_BASE_URL}${path}`, init);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  return payload as T;
}

function getStoredAdminSession() {
  if (typeof window === "undefined") {
    return "";
  }

  return localStorage.getItem("kzt_admin_session") ?? "";
}

function getErrorMessage(payload: unknown, status: number) {
  if (status === 403) {
    return "\u6743\u9650\u4e0d\u8db3\uff0c\u65e0\u6cd5\u6267\u884c\u8be5\u64cd\u4f5c";
  }

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




