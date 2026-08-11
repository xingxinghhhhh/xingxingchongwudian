"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { CommunityPost } from "../cloud-pets/cloud-pets-api";
import { formatCents, OrderResponse, ShopProductDetail } from "../shop/shop-api";
import { getGrowthTaskCopy } from "../cloud-pets/cloud-pet-copy";
import { getProductTitleLabel } from "../shop/shop-copy";
import {
  AdminCloudPet,
  AdminCloudPetOpsHealth,
  AdminCloudPetLaunchReadiness,
  AdminDeploymentReadiness,
  AdminSqliteRecoveryStatus,
  AdminCloudPetCareScoreRules,
  AdminCloudPetOperationalDetail,
  AdminCloudPetRetentionMetrics,
  AdminCloudPetGrowthTaskOperations,
  AdminCommunityReport,
  AdminDashboardMetrics,
  AdminCmsBlock,
  AdminCmsBlockStatus,
  AdminProductReview,
  AdminStaffProfile,
  AdminCustomerListItem,
  adminLogout,
  CloudPetDailyDiaryGenerationResult,
  CloudPetDailyDiaryStatusResult,
  CouponCampaign,
  CouponStatus,
  LowStockVariant,
  CommunityModerationStatus,
  CommunityReportStatus,
  MerchantAnalytics,
  OperationLogRecord,
  ProductStatus,
  RefundRequestRecord,
  createAdminProduct,
  createCustomerFollowUp,
  createCmsBlock,
  fulfillOrder,
  generateCloudPetDailyDiaries,
  getCloudPetDailyDiaryStatus,
  getAdminCloudPetCareScoreRules,
  getAdminCloudPetDetail,
  getAdminCloudPetRetentionMetrics,
  getAdminCloudPetGrowthTaskOperations,
  getCurrentAdminStaff,
  getAdminDashboard,
  getCloudPetOpsHealth,
  getAdminCloudPetLaunchReadiness,
  getAdminDeploymentReadiness,
  getAdminSqliteRecoveryStatus,
  runAdminSqliteRecovery,
  getMerchantAnalytics,
  listAdminCustomers,
  listAdminCloudPets,
  listAdminCommunityPosts,
  listAdminCommunityReports,
  listAdminCoupons,
  listAdminCmsBlocks,
  listAdminOrders,
  listAdminProducts,
  listAdminRefunds,
  listAdminReviews,
  listLowStockVariants,
  listOperationLogs,
  recordShipmentEvent,
  removeAdminCloudPetDiaryNote,
  updateCommunityPostStatus,
  updateCommunityReportStatus,
  updateCmsBlockStatus,
  updateCouponStatus,
  updateCustomerCrm,
  updateAdminCloudPetCareScoreRules,
  updateAdminCloudPetGrowthTask,
  updateProductStatus,
  updateRefundStatus,
  updateReviewStatus,
  updateVariantStock
} from "./admin-api";
import {
  compareCloudPetWebApiRelease,
  getCloudPetEffectiveLaunchStatus,
  getCloudPetWebRelease,
  getCloudPetWebReleaseAttention
} from "./cloud-pet-web-release";
import {
  getAdminRoleLabel,
  getAdminStaffNameLabel,
  getCustomerSegmentCopy,
  getCustomerTagLabel,
  getOperationActionLabel,
  getOperationTargetLabel,
  getPermissionLabel,
  getPriorityLabel,
  getRetentionFunnelCopy,
  getRiskLevelLabel,
  getStatusLabel
} from "./admin-copy";
import {
  compareCloudPetRisk,
  evaluateCloudPetRisk,
  getCloudPetRiskReasonCounts,
  cloudPetRiskReasonOptions,
  matchesCloudPetRiskReason,
  type CloudPetRiskReasonCode
} from "./cloud-pet-risk";
import {
  applyCloudPetFilterQuery,
  applyCloudPetSelectedPetNo,
  defaultCloudPetStructuredFilters,
  parseCloudPetFilterQuery,
  parseCloudPetSelectedPetNo,
  type CloudPetStructuredFilters
} from "./cloud-pet-filter-query";

const defaultToken = "";

function getInitialCommunityReportFilters() {
  if (typeof window === "undefined") {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);
  return searchParams.get("reportStatus") === "pending_review"
    ? {
        status: "pending_review" as const,
        postNo: searchParams.get("reportPostNo")?.trim() ?? "",
        memberPhone: ""
      }
    : null;
}

function replaceCloudPetFilterUrl(filters: CloudPetStructuredFilters) {
  const nextSearchParams = applyCloudPetFilterQuery(
    new URLSearchParams(window.location.search),
    filters
  );
  const query = nextSearchParams.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function replaceCloudPetSelectedPetUrl(
  petNo: string | null,
  mode: "push" | "replace" = "replace"
) {
  const nextSearchParams = applyCloudPetSelectedPetNo(
    new URLSearchParams(window.location.search),
    petNo
  );
  const query = nextSearchParams.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  if (mode === "push") {
    window.history.pushState({}, "", nextUrl);
  } else {
    window.history.replaceState({}, "", nextUrl);
  }
}

function getCloudPetApiFilters(filters: CloudPetStructuredFilters, q = "") {
  return {
    q: q.trim() || undefined,
    species: filters.species || undefined,
    careState: filters.careState || undefined
  };
}

export function AdminConsole() {
  const webRelease = getCloudPetWebRelease();
  const [token, setToken] = useState(defaultToken);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [cloudPetOpsHealth, setCloudPetOpsHealth] =
    useState<AdminCloudPetOpsHealth | null>(null);
  const [cloudPetOpsHealthLoading, setCloudPetOpsHealthLoading] = useState(false);
  const [cloudPetOpsHealthError, setCloudPetOpsHealthError] = useState<string | null>(null);
  const [deploymentReadiness, setDeploymentReadiness] =
    useState<AdminDeploymentReadiness | null>(null);
  const [deploymentReadinessLoading, setDeploymentReadinessLoading] = useState(false);
  const [deploymentReadinessError, setDeploymentReadinessError] = useState<string | null>(null);
  const [cloudPetLaunchReadiness, setCloudPetLaunchReadiness] =
    useState<AdminCloudPetLaunchReadiness | null>(null);
  const [cloudPetLaunchReadinessLoading, setCloudPetLaunchReadinessLoading] =
    useState(false);
  const [cloudPetLaunchReadinessError, setCloudPetLaunchReadinessError] =
    useState<string | null>(null);
  const [sqliteRecoveryStatus, setSqliteRecoveryStatus] =
    useState<AdminSqliteRecoveryStatus | null>(null);
  const [sqliteRecoveryStatusLoading, setSqliteRecoveryStatusLoading] = useState(false);
  const [sqliteRecoveryStatusError, setSqliteRecoveryStatusError] = useState<string | null>(null);
  const [sqliteRecoveryRunLoading, setSqliteRecoveryRunLoading] = useState(false);
  const [analytics, setAnalytics] = useState<MerchantAnalytics | null>(null);
  const [currentStaff, setCurrentStaff] = useState<AdminStaffProfile | null>(null);
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [cmsBlocks, setCmsBlocks] = useState<AdminCmsBlock[]>([]);
  const [pets, setPets] = useState<AdminCloudPet[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [reports, setReports] = useState<AdminCommunityReport[]>([]);
  const [products, setProducts] = useState<ShopProductDetail[]>([]);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [coupons, setCoupons] = useState<CouponCampaign[]>([]);
  const [refunds, setRefunds] = useState<RefundRequestRecord[]>([]);
  const [reviews, setReviews] = useState<AdminProductReview[]>([]);
  const [lowStock, setLowStock] = useState<LowStockVariant[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLogRecord[]>([]);
  const [status, setStatus] = useState("正在加载商家运营数据...");
  const [error, setError] = useState<string | null>(null);
  const [busyPostNo, setBusyPostNo] = useState<string | null>(null);
  const [busyReportNo, setBusyReportNo] = useState<string | null>(null);
  const [busyProductKey, setBusyProductKey] = useState<string | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [busyOrderNo, setBusyOrderNo] = useState<string | null>(null);
  const [busyCouponCode, setBusyCouponCode] = useState<string | null>(null);
  const [busyRefundNo, setBusyRefundNo] = useState<string | null>(null);
  const [busyReviewNo, setBusyReviewNo] = useState<string | null>(null);
  const [busyCmsBlockNo, setBusyCmsBlockNo] = useState<string | null>(null);
  const [isCreatingCmsBlock, setIsCreatingCmsBlock] = useState(false);
  const [busyCustomerPhone, setBusyCustomerPhone] = useState<string | null>(null);
  const [busyCloudPetNo, setBusyCloudPetNo] = useState<string | null>(null);
  const [busyGrowthTaskKey, setBusyGrowthTaskKey] = useState<string | null>(null);
  const [busyDiaryNoteId, setBusyDiaryNoteId] = useState<string | null>(null);
  const [selectedCloudPetDetail, setSelectedCloudPetDetail] =
    useState<AdminCloudPetOperationalDetail | null>(null);
  const [cloudPetRefreshing, setCloudPetRefreshing] = useState(false);
  const [cloudPetLastSuccessfulRefreshAt, setCloudPetLastSuccessfulRefreshAt] =
    useState<Date | null>(null);
  const [isGeneratingDailyDiaries, setIsGeneratingDailyDiaries] = useState(false);
  const [dailyDiaryGeneration, setDailyDiaryGeneration] =
    useState<CloudPetDailyDiaryGenerationResult | null>(null);
  const [dailyDiaryStatus, setDailyDiaryStatus] =
    useState<CloudPetDailyDiaryStatusResult | null>(null);
  const [cloudPetRetentionMetrics, setCloudPetRetentionMetrics] =
    useState<AdminCloudPetRetentionMetrics | null>(null);
  const [cloudPetGrowthTaskOperations, setCloudPetGrowthTaskOperations] =
    useState<AdminCloudPetGrowthTaskOperations | null>(null);
  const [cloudPetCareScoreRules, setCloudPetCareScoreRules] =
    useState<AdminCloudPetCareScoreRules | null>(null);
  const [isUpdatingCareScoreRules, setIsUpdatingCareScoreRules] = useState(false);
  const [cloudPetFilters, setCloudPetFilters] = useState({
    q: "",
    species: "",
    careState: "",
    riskLevel: "",
    riskReason: "" as CloudPetRiskReasonCode | "",
    sortBy: ""
  });
  const [appliedCloudPetStructuredFilters, setAppliedCloudPetStructuredFilters] =
    useState<CloudPetStructuredFilters>(defaultCloudPetStructuredFilters);
  const [appliedCloudPetSearch, setAppliedCloudPetSearch] = useState("");
  const [reportFilters, setReportFilters] = useState({
    status: "",
    postNo: "",
    memberPhone: ""
  });
  const canManageCustomers =
    currentStaff?.permissions.includes("customers:write") ?? false;
  const canManageCloudPets =
    currentStaff?.permissions.includes("cloud_pets:write") ?? false;
  const filteredCloudPetsByRiskLevel = pets.filter((pet) => {
    const matchesRiskLevel =
      !cloudPetFilters.riskLevel ||
      evaluateCloudPetRisk(pet).highestLevel === cloudPetFilters.riskLevel;

    return matchesRiskLevel;
  });
  const riskReasonCounts = getCloudPetRiskReasonCounts(filteredCloudPetsByRiskLevel);
  const filteredCloudPets = filteredCloudPetsByRiskLevel.filter((pet) =>
    matchesCloudPetRiskReason(pet, cloudPetFilters.riskReason)
  );
  const displayedCloudPets = cloudPetFilters.sortBy === "risk_desc"
    ? [...filteredCloudPets].sort(compareCloudPetRisk)
    : filteredCloudPets;
  const selectedCloudPetIndex = selectedCloudPetDetail
    ? displayedCloudPets.findIndex(
        (pet) => pet.petNo === selectedCloudPetDetail.pet.petNo
      )
    : -1;

  useEffect(() => {
    const storedToken = localStorage.getItem("kzt_admin_session") ?? defaultToken;
    const initialReportFilters = getInitialCommunityReportFilters();
    const initialCloudPetStructuredFilters = parseCloudPetFilterQuery(
      new URLSearchParams(window.location.search)
    );
    const initialCloudPetSelectedPetNo = parseCloudPetSelectedPetNo(
      new URLSearchParams(window.location.search)
    );
    setToken(storedToken);
    setCloudPetFilters((current) => ({
      ...current,
      ...initialCloudPetStructuredFilters
    }));
    setAppliedCloudPetStructuredFilters(initialCloudPetStructuredFilters);
    if (initialReportFilters) {
      setReportFilters(initialReportFilters);
    }
    if (storedToken) {
      void loadAdminData(
        storedToken,
        initialReportFilters ?? undefined,
        initialCloudPetStructuredFilters,
        "",
        initialCloudPetSelectedPetNo
      );
    }

    const handleCloudPetFilterPopState = () => {
      const nextFilters = parseCloudPetFilterQuery(
        new URLSearchParams(window.location.search)
      );
      const nextSelectedPetNo = parseCloudPetSelectedPetNo(
        new URLSearchParams(window.location.search)
      );
      setCloudPetFilters((current) => ({
        ...current,
        q: "",
        ...nextFilters
      }));
      setAppliedCloudPetStructuredFilters(nextFilters);
      setAppliedCloudPetSearch("");
      if (storedToken) {
        void loadCloudPetList(storedToken, nextFilters, nextSelectedPetNo);
      } else {
        setSelectedCloudPetDetail(null);
      }
    };

    window.addEventListener("popstate", handleCloudPetFilterPopState);
    return () => window.removeEventListener("popstate", handleCloudPetFilterPopState);
  }, []);

  async function loadAdminData(
    nextToken = token,
    initialReportFilters?: {
      status: "pending_review";
      postNo: string;
      memberPhone: string;
    },
    initialCloudPetFilters = appliedCloudPetStructuredFilters,
    initialCloudPetSearch = appliedCloudPetSearch,
    initialCloudPetSelectedPetNo: string | null = null
  ) {
    if (!nextToken) {
      setError("需要后台登录会话");
      return;
    }

    setError(null);

    try {
      const nextStaff = await getCurrentAdminStaff(nextToken);
      const [
        nextMetrics,
        nextAnalytics,
        nextCustomers,
        nextCmsBlocks,
        nextPets,
        nextPosts,
        nextReports,
        nextProducts,
        nextOrders,
        nextCoupons,
        nextRefunds,
        nextReviews,
        nextLowStock,
        nextDailyDiaryStatus,
        nextCloudPetRetentionMetrics,
        nextCloudPetGrowthTaskOperations,
        nextCloudPetCareScoreRules,
        nextOperationLogs
      ] = await Promise.all([
        getAdminDashboard(nextToken),
        getMerchantAnalytics(nextToken),
        listAdminCustomers(nextToken),
        listAdminCmsBlocks(nextToken),
        listAdminCloudPets(
          nextToken,
          getCloudPetApiFilters(initialCloudPetFilters, initialCloudPetSearch)
        ),
        listAdminCommunityPosts(nextToken),
        listAdminCommunityReports(nextToken, initialReportFilters),
        listAdminProducts(nextToken),
        listAdminOrders(nextToken),
        listAdminCoupons(nextToken),
        listAdminRefunds(nextToken),
        listAdminReviews(nextToken),
        listLowStockVariants(nextToken),
        getCloudPetDailyDiaryStatus(nextToken),
        getAdminCloudPetRetentionMetrics(nextToken),
        getAdminCloudPetGrowthTaskOperations(nextToken),
        getAdminCloudPetCareScoreRules(nextToken),
        nextStaff.permissions.includes("audit:read") ? listOperationLogs(nextToken)
          : Promise.resolve([])
      ]);

      setCurrentStaff(nextStaff);
      setMetrics(nextMetrics);
      setAnalytics(nextAnalytics);
      setCustomers(nextCustomers);
      setCmsBlocks(nextCmsBlocks);
      setPets(nextPets);
      setCloudPetLastSuccessfulRefreshAt(new Date());
      if (initialCloudPetSelectedPetNo) {
        if (nextPets.some((pet) => pet.petNo === initialCloudPetSelectedPetNo)) {
          await loadCloudPetDetail(initialCloudPetSelectedPetNo, false, nextToken);
        } else {
          setSelectedCloudPetDetail(null);
          replaceCloudPetSelectedPetUrl(null);
        }
      }
      setPosts(nextPosts);
      setReports(nextReports);
      setProducts(nextProducts);
      setOrders(nextOrders);
      setCoupons(nextCoupons);
      setRefunds(nextRefunds);
      setReviews(nextReviews);
      setLowStock(nextLowStock);
      setDailyDiaryStatus(nextDailyDiaryStatus);
      setCloudPetRetentionMetrics(nextCloudPetRetentionMetrics);
      setCloudPetGrowthTaskOperations(nextCloudPetGrowthTaskOperations);
      setCloudPetCareScoreRules(nextCloudPetCareScoreRules);
      setOperationLogs(nextOperationLogs);
      if (nextStaff.role === "owner") {
        void loadDeploymentReadiness(nextToken, nextStaff.role);
        void loadCloudPetOpsHealth(nextToken, nextStaff.role);
        void loadSqliteRecoveryStatus(nextToken, nextStaff.role);
        void loadCloudPetLaunchReadiness(nextToken, nextStaff.role);
      } else {
        setDeploymentReadiness(null);
        setDeploymentReadinessError(null);
        setCloudPetLaunchReadiness(null);
        setCloudPetLaunchReadinessError(null);
        setCloudPetOpsHealth(null);
        setCloudPetOpsHealthError(null);
        setSqliteRecoveryStatus(null);
        setSqliteRecoveryStatusError(null);
      }
      setStatus("商家运营数据已刷新。");
    } catch (caught) {
      if (
        nextToken.startsWith("admin_") &&
        caught instanceof Error &&
        caught.message === "Invalid admin session"
      ) {
        localStorage.removeItem("kzt_admin_session");
        window.location.href = "/admin/login";
        return;
      }

      setError(caught instanceof Error ? caught.message : "后台数据加载失败");
    }
  }

  async function loadCloudPetList(
    nextToken: string,
    nextFilters: CloudPetStructuredFilters,
    nextSelectedPetNo: string | null = null
  ) {
    try {
      const nextPets = await listAdminCloudPets(
        nextToken,
        getCloudPetApiFilters(nextFilters)
      );
      setPets(nextPets);
      setCloudPetLastSuccessfulRefreshAt(new Date());
      if (nextSelectedPetNo) {
        if (nextPets.some((pet) => pet.petNo === nextSelectedPetNo)) {
          await loadCloudPetDetail(nextSelectedPetNo, false, nextToken);
        } else {
          setSelectedCloudPetDetail(null);
          replaceCloudPetSelectedPetUrl(null);
        }
      } else {
        setSelectedCloudPetDetail(null);
      }
      setStatus(`云养宠筛选已恢复，共 ${nextPets.length} 条结果。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "云养宠筛选恢复失败");
    }
  }

  function updateLiveCloudPetFilter<Key extends keyof CloudPetStructuredFilters>(
    key: Key,
    value: CloudPetStructuredFilters[Key]
  ) {
    const nextFilters = {
      ...appliedCloudPetStructuredFilters,
      [key]: value
    } as CloudPetStructuredFilters;
    setAppliedCloudPetStructuredFilters(nextFilters);
    setCloudPetFilters((current) => ({ ...current, [key]: value }));
    replaceCloudPetFilterUrl(nextFilters);
  }

  async function handleLogout() {
    if (token) {
      try {
        await adminLogout(token);
      } catch {
        // 无论接口是否成功，前端会话都必须清除。
      }
    }

    localStorage.removeItem("kzt_admin_session");
    window.location.href = "/admin/login";
  }

  async function handleStockUpdate(skuCode: string, stockText: string) {
    const stock = Number(stockText);

    if (!Number.isInteger(stock) || stock < 0) {
      setError("库存必须是 0 或正整数");
      return;
    }

    setBusyProductKey(skuCode);
    setError(null);

    try {
      await updateVariantStock(skuCode, stock, token);
      await loadAdminData(token);
      setStatus(`${skuCode} 库存已更新为 ${stock}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "库存更新失败");
    } finally {
      setBusyProductKey(null);
    }
  }

  async function handleProductStatus(slug: string, statusValue: ProductStatus) {
    setBusyProductKey(slug);
    setError(null);

    try {
      await updateProductStatus(slug, statusValue, token);
      await loadAdminData(token);
      setStatus(`商品已${statusValue === "active" ? "上架" : "下架"}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "商品状态更新失败");
    } finally {
      setBusyProductKey(null);
    }
  }

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const priceCents = Math.round(Number(formData.get("priceYuan")) * 100);
    const stock = Number(formData.get("stock"));

    if (!Number.isInteger(priceCents) || priceCents <= 0) {
      setError("商品价格必须大于 0");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("库存必须是 0 或正整数");
      return;
    }

    setIsCreatingProduct(true);
    setError(null);

    try {
      await createAdminProduct(
        {
          slug: String(formData.get("slug") ?? ""),
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          petType: String(formData.get("petType") ?? "both") as "cat" | "dog" | "both",
          toyType: String(formData.get("toyType") ?? ""),
          status: "active",
          images: [String(formData.get("imageUrl") ?? "")],
          variants: [
            {
              skuCode: String(formData.get("skuCode") ?? ""),
              name: String(formData.get("variantName") ?? ""),
              color: String(formData.get("color") ?? ""),
              size: String(formData.get("size") ?? ""),
              material: String(formData.get("material") ?? ""),
              priceCents,
              stock
            }
          ]
        },
        token
      );
      event.currentTarget.reset();
      await loadAdminData(token);
      setStatus("商品已创建并上架。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "商品创建失败");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function handleCreateCmsBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sortOrder = Number(formData.get("sortOrder") ?? 100);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("内容块排序值必须是 0 或正整数");
      return;
    }

    setIsCreatingCmsBlock(true);
    setError(null);

    try {
      await createCmsBlock(
        {
          slotKey: String(formData.get("slotKey") ?? ""),
          title: String(formData.get("title") ?? ""),
          body: String(formData.get("body") ?? ""),
          ctaLabel: String(formData.get("ctaLabel") ?? ""),
          href: String(formData.get("href") ?? ""),
          imageUrl: String(formData.get("imageUrl") ?? ""),
          status: String(formData.get("status") ?? "draft") as AdminCmsBlockStatus,
          sortOrder
        },
        token
      );
      event.currentTarget.reset();
      await loadAdminData(token);
      setStatus("内容块已创建。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "内容块创建失败");
    } finally {
      setIsCreatingCmsBlock(false);
    }
  }

  async function handleCmsBlockStatus(
    blockNo: string,
    statusValue: AdminCmsBlockStatus
  ) {
    setBusyCmsBlockNo(blockNo);
    setError(null);

    try {
      await updateCmsBlockStatus(blockNo, statusValue, token);
      await loadAdminData(token);
      setStatus(`${blockNo} 内容块已更新为${getStatusLabel(statusValue)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "内容块状态更新失败");
    } finally {
      setBusyCmsBlockNo(null);
    }
  }

  async function handleMarkCustomerVip(customer: AdminCustomerListItem) {
    if (!canManageCustomers) {
      setError("权限不足，无法执行该操作：customers:write");
      return;
    }

    setBusyCustomerPhone(customer.phone);
    setError(null);

    try {
      await updateCustomerCrm(
        customer.phone,
        {
          tags: Array.from(new Set([...customer.tags, "vip_candidate"])),
          note: "从商家客户管理台标记，后续跟进组合权益。",
          ownerStaffName: currentStaff?.name
        },
        token
      );
      await loadAdminData(token);
      setStatus(`${customer.phone} 已标记为 VIP 候选客户。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "客户资料更新失败");
    } finally {
      setBusyCustomerPhone(null);
    }
  }

  async function handleCustomerFollowUp(customer: AdminCustomerListItem) {
    if (!canManageCustomers) {
      setError("权限不足，无法执行该操作：customers:write");
      return;
    }

    setBusyCustomerPhone(customer.phone);
    setError(null);

    try {
      await createCustomerFollowUp(
        customer.phone,
        {
          type: "wechat",
          summary: `已跟进：${customer.nextBestAction.ctaLabel}。`
        },
        token
      );
      await loadAdminData(token);
      setStatus(`${customer.phone} 的跟进记录已保存。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "客户跟进记录保存失败");
    } finally {
      setBusyCustomerPhone(null);
    }
  }

  async function handleCouponStatus(code: string, statusValue: CouponStatus) {
    setBusyCouponCode(code);
    setError(null);

    try {
      await updateCouponStatus(code, statusValue, token);
      await loadAdminData(token);
      setStatus(`${code} 已更新为${getStatusLabel(statusValue)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "优惠券更新失败");
    } finally {
      setBusyCouponCode(null);
    }
  }

  async function handleRefundStatus(
    refundNo: string,
    statusValue: "approved" | "rejected"
  ) {
    setBusyRefundNo(refundNo);
    setError(null);

    try {
      await updateRefundStatus(
        refundNo,
        statusValue,
        statusValue === "approved" ? "商家后台审核通过" : "商家后台审核拒绝",
        token
      );
      await loadAdminData(token);
      setStatus(`${refundNo} 已${statusValue === "approved" ? "通过" : "拒绝"}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "退款审核失败");
    } finally {
      setBusyRefundNo(null);
    }
  }

  async function handleReviewStatus(
    reviewNo: string,
    statusValue: "visible" | "hidden"
  ) {
    setBusyReviewNo(reviewNo);
    setError(null);

    try {
      await updateReviewStatus(reviewNo, statusValue, token);
      await loadAdminData(token);
      setStatus(`${reviewNo} 评价已更新为${getStatusLabel(statusValue)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评价更新失败");
    } finally {
      setBusyReviewNo(null);
    }
  }

  async function handleFulfillment(
    orderNo: string,
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const carrier = String(formData.get("carrier") ?? "");
    const trackingNumber = String(formData.get("trackingNumber") ?? "");

    setBusyOrderNo(orderNo);
    setError(null);

    try {
      await fulfillOrder(orderNo, { carrier, trackingNumber }, token);
      await loadAdminData(token);
      setStatus(`${orderNo} 物流信息已登记。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "订单履约失败");
    } finally {
      setBusyOrderNo(null);
    }
  }

  async function handleShipmentEvent(
    orderNo: string,
    statusValue: "in_transit" | "out_for_delivery" | "delivered" | "exception"
  ) {
    setBusyOrderNo(orderNo);
    setError(null);

    const copyByStatus = {
      in_transit: {
        location: "中转中心",
        description: "包裹正在运往下一站。"
      },
      out_for_delivery: {
        location: "本地配送站",
        description: "快递员正在派送。"
      },
      delivered: {
        location: "收货地址",
        description: "客户已签收包裹。"
      },
      exception: {
        location: "承运商服务台",
        description: "配送异常，需要商家跟进。"
      }
    } satisfies Record<
      "in_transit" | "out_for_delivery" | "delivered" | "exception",
      { location: string; description: string }
    >;

    try {
      await recordShipmentEvent(
        orderNo,
        {
          status: statusValue,
          ...copyByStatus[statusValue]
        },
        token
      );
      await loadAdminData(token);
      setStatus(`${orderNo} 物流状态已更新为${getStatusLabel(statusValue)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "物流状态更新失败");
    } finally {
      setBusyOrderNo(null);
    }
  }

  async function handleModeration(
    postNo: string,
    statusValue: CommunityModerationStatus
  ) {
    setBusyPostNo(postNo);
    setError(null);

    try {
      await updateCommunityPostStatus(postNo, statusValue, token);
      await loadAdminData(token);
      setStatus(`社区帖子已更新为${getStatusLabel(statusValue)}。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "社区审核失败");
    } finally {
      setBusyPostNo(null);
    }
  }

  function getCommunityReportFilters() {
    const status = ["pending_review", "reviewed", "dismissed"].includes(reportFilters.status)
      ? (reportFilters.status as CommunityReportStatus)
      : undefined;

    return {
      status,
      postNo: reportFilters.postNo,
      memberPhone: reportFilters.memberPhone
    };
  }

  async function refreshCommunityReports() {
    const nextReports = await listAdminCommunityReports(token, getCommunityReportFilters());
    setReports(nextReports);
    return nextReports;
  }

  async function handleReportStatus(
    reportNo: string,
    statusValue: "reviewed" | "dismissed",
    options: { hidePostNo?: string } = {}
  ) {
    setBusyReportNo(reportNo);
    setError(null);
    let postWasHidden = false;

    try {
      if (options.hidePostNo) {
        const updatedPost = await updateCommunityPostStatus(
          options.hidePostNo,
          "hidden",
          token
        );
        postWasHidden = true;
        setPosts((current) =>
          current.map((post) =>
            post.postNo === updatedPost.postNo ? updatedPost : post
          )
        );
      }
      await updateCommunityReportStatus(
        reportNo,
        statusValue,
        options.hidePostNo
          ? "商家后台已处理并隐藏关联帖子"
          : statusValue === "reviewed"
            ? "商家后台已处理"
            : "商家后台已驳回",
        token
      );
      await refreshCommunityReports();
      setStatus(
        options.hidePostNo
          ? "社区举报已处理，关联帖子已隐藏。"
          : "社区举报已更新为" + getStatusLabel(statusValue) + "。"
      );
    } catch (caught) {
      setError(
        postWasHidden
          ? "关联帖子已隐藏，但举报状态更新失败，请重试处理。"
          : caught instanceof Error
            ? caught.message
            : "举报状态更新失败"
      );
    } finally {
      setBusyReportNo(null);
    }
  }

  async function loadCloudPetOpsHealth(
    nextToken = token,
    role = currentStaff?.role
  ) {
    if (role !== "owner") {
      setCloudPetOpsHealth(null);
      setCloudPetOpsHealthError(null);
      return;
    }

    setCloudPetOpsHealthLoading(true);
    setCloudPetOpsHealthError(null);

    try {
      setCloudPetOpsHealth(await getCloudPetOpsHealth(nextToken));
    } catch (caught) {
      setCloudPetOpsHealthError(
        caught instanceof Error ? caught.message : "系统运行状态暂时无法获取"
      );
    } finally {
      setCloudPetOpsHealthLoading(false);
    }
  }

  async function loadDeploymentReadiness(
    nextToken = token,
    role = currentStaff?.role
  ) {
    if (!nextToken || role !== "owner") {
      setDeploymentReadiness(null);
      setDeploymentReadinessError(null);
      return;
    }

    setDeploymentReadinessLoading(true);
    setDeploymentReadinessError(null);
    try {
      setDeploymentReadiness(await getAdminDeploymentReadiness(nextToken));
    } catch (caught) {
      setDeploymentReadinessError(
        caught instanceof Error ? caught.message : "暂时无法读取部署状态"
      );
    } finally {
      setDeploymentReadinessLoading(false);
    }
  }

  async function loadCloudPetLaunchReadiness(
    nextToken = token,
    role = currentStaff?.role
  ) {
    if (!nextToken || role !== "owner") {
      setCloudPetLaunchReadiness(null);
      setCloudPetLaunchReadinessError(null);
      return;
    }

    setCloudPetLaunchReadinessLoading(true);
    setCloudPetLaunchReadinessError(null);
    try {
      setCloudPetLaunchReadiness(await getAdminCloudPetLaunchReadiness(nextToken));
    } catch (caught) {
      setCloudPetLaunchReadinessError(
        caught instanceof Error ? caught.message : "上线检查暂时无法获取"
      );
    } finally {
      setCloudPetLaunchReadinessLoading(false);
    }
  }

  async function loadSqliteRecoveryStatus(
    nextToken = token,
    role = currentStaff?.role
  ) {
    if (!nextToken || role !== "owner") {
      setSqliteRecoveryStatus(null);
      setSqliteRecoveryStatusError(null);
      return;
    }

    setSqliteRecoveryStatusLoading(true);
    setSqliteRecoveryStatusError(null);
    try {
      setSqliteRecoveryStatus(await getAdminSqliteRecoveryStatus(nextToken));
    } catch (caught) {
      setSqliteRecoveryStatusError(
        caught instanceof Error ? caught.message : "数据保护状态加载失败"
      );
    } finally {
      setSqliteRecoveryStatusLoading(false);
    }
  }

  async function handleSqliteRecoveryRun() {
    if (!token || currentStaff?.role !== "owner") return;

    setSqliteRecoveryRunLoading(true);
    setSqliteRecoveryStatusError(null);
    try {
      await runAdminSqliteRecovery(token);
      await loadSqliteRecoveryStatus(token, currentStaff.role);
    } catch (caught) {
      setSqliteRecoveryStatusError(
        caught instanceof Error ? caught.message : "创建并验证备份失败"
      );
      await loadSqliteRecoveryStatus(token, currentStaff.role);
    } finally {
      setSqliteRecoveryRunLoading(false);
    }
  }

  async function handleCommunityReportFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("需要后台登录会话");
      return;
    }

    setError(null);

    try {
      const nextReports = await refreshCommunityReports();
      setStatus(`社区举报筛选已应用，共 ${nextReports.length} 条结果。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "社区举报筛选失败");
    }
  }

  async function handleResetCommunityReportFilters() {
    if (!token) {
      setError("需要后台登录会话");
      return;
    }

    setReportFilters({ status: "", postNo: "", memberPhone: "" });
    setError(null);

    try {
      const nextReports = await listAdminCommunityReports(token);
      setReports(nextReports);
      setStatus("社区举报筛选已清除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "社区举报筛选重置失败");
    }
  }

  async function handleCloudPetFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("需要后台登录会话");
      return;
    }

    setError(null);

    const nextStructuredFilters: CloudPetStructuredFilters = {
      species:
        cloudPetFilters.species === "cat" || cloudPetFilters.species === "dog"
          ? cloudPetFilters.species
          : "",
      careState:
        cloudPetFilters.careState === "needs_care" ||
        cloudPetFilters.careState === "steady" ||
        cloudPetFilters.careState === "thriving"
          ? cloudPetFilters.careState
          : "",
      riskLevel:
        cloudPetFilters.riskLevel === "high" ||
        cloudPetFilters.riskLevel === "medium" ||
        cloudPetFilters.riskLevel === "low"
          ? cloudPetFilters.riskLevel
          : "",
      riskReason: cloudPetFilters.riskReason,
      sortBy: cloudPetFilters.sortBy === "risk_desc" ? "risk_desc" : ""
    };

    try {
      const filteredPets = await listAdminCloudPets(token, {
        ...getCloudPetApiFilters(nextStructuredFilters),
        q: cloudPetFilters.q
      });
      setPets(filteredPets);
      setAppliedCloudPetStructuredFilters(nextStructuredFilters);
      setAppliedCloudPetSearch(cloudPetFilters.q);
      replaceCloudPetFilterUrl(nextStructuredFilters);
      setStatus(`云养宠筛选已应用，共 ${filteredPets.length} 条结果。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "云养宠筛选失败");
    }
  }

  async function handleResetCloudPetFilters() {
    if (!token) {
      setError("需要后台登录会话");
      return;
    }

    setCloudPetFilters({
      q: "",
      species: "",
      careState: "",
      riskLevel: "",
      riskReason: "",
      sortBy: ""
    });
    setAppliedCloudPetStructuredFilters(defaultCloudPetStructuredFilters);
    setAppliedCloudPetSearch("");
    replaceCloudPetFilterUrl(defaultCloudPetStructuredFilters);
    setError(null);

    try {
      const allPets = await listAdminCloudPets(
        token,
        getCloudPetApiFilters(defaultCloudPetStructuredFilters)
      );
      setPets(allPets);
      setCloudPetLastSuccessfulRefreshAt(new Date());
      setStatus("云养宠筛选已清除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "云养宠筛选重置失败");
    }
  }

  async function handleRefreshCloudPets() {
    if (!token || cloudPetRefreshing) {
      return;
    }

    setCloudPetRefreshing(true);
    setError(null);

    try {
      const nextPets = await listAdminCloudPets(
        token,
        getCloudPetApiFilters(
          appliedCloudPetStructuredFilters,
          appliedCloudPetSearch
        )
      );
      setPets(nextPets);
      setCloudPetLastSuccessfulRefreshAt(new Date());

      if (selectedCloudPetDetail) {
        try {
          const nextDetail = await getAdminCloudPetDetail(
            token,
            selectedCloudPetDetail.pet.petNo
          );
          setSelectedCloudPetDetail(nextDetail);
        } catch {
          setError("云养宠列表已刷新，但详情更新失败，请稍后重试。");
        }
      }

      setStatus(`云养宠数据已刷新，共 ${nextPets.length} 条结果。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "云养宠数据刷新失败");
    } finally {
      setCloudPetRefreshing(false);
    }
  }

  async function loadCloudPetDetail(
    petNo: string,
    updateUrl = false,
    nextToken = token
  ) {
    setBusyCloudPetNo(petNo);
    setError(null);

    try {
      const detail = await getAdminCloudPetDetail(nextToken, petNo);
      setSelectedCloudPetDetail(detail);
      if (updateUrl) {
        replaceCloudPetSelectedPetUrl(petNo, "push");
      }
      setStatus(`${detail.pet.name} 的云养宠运营详情已加载。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "云养宠详情加载失败");
    } finally {
      setBusyCloudPetNo(null);
    }
  }

  async function handleLoadCloudPetDetail(petNo: string) {
    await loadCloudPetDetail(petNo, true);
  }

  function handleNavigateCloudPet(direction: -1 | 1) {
    if (selectedCloudPetIndex < 0) {
      return;
    }

    const nextPet = displayedCloudPets[selectedCloudPetIndex + direction];
    if (nextPet) {
      void handleLoadCloudPetDetail(nextPet.petNo);
    }
  }

  function handleClearCloudPetDetail() {
    setSelectedCloudPetDetail(null);
    replaceCloudPetSelectedPetUrl(null);
    setStatus("云养宠详情已收起。");
  }

  async function handleRemoveCloudPetDiaryNote(petNo: string, noteId: string) {
    setBusyDiaryNoteId(noteId);
    setError(null);

    try {
      await removeAdminCloudPetDiaryNote(token, petNo, noteId);
      const detail = await getAdminCloudPetDetail(token, petNo);
      setSelectedCloudPetDetail(detail);
      await loadAdminData(token);
      setStatus("主人手记已从公开归档中移除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "主人手记移除失败");
    } finally {
      setBusyDiaryNoteId(null);
    }
  }
  async function handleUpdateGrowthTaskTemplate(
    event: FormEvent<HTMLFormElement>,
    taskKey: string
  ) {
    event.preventDefault();

    if (!canManageCloudPets) {
      setError("权限不足，无法执行该操作：cloud_pets:write");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setBusyGrowthTaskKey(taskKey);
    setError(null);

    try {
      const task = await updateAdminCloudPetGrowthTask(token, taskKey, {
        points: Number(formData.get("points")),
        rewards: {
          mood: Number(formData.get("mood")),
          energy: Number(formData.get("energy")),
          intimacy: Number(formData.get("intimacy"))
        }
      });
      await loadAdminData(token);
      setStatus(`成长任务“${getGrowthTaskCopy(task).title}”已更新。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "成长任务更新失败");
    } finally {
      setBusyGrowthTaskKey(null);
    }
  }
  async function handleUpdateCareScoreRules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManageCloudPets) {
      setError("权限不足，无法执行该操作：cloud_pets:write");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const dailyTaskBonus = Number(formData.get("dailyTaskBonus"));
    const steadyMinScore = Number(formData.get("steadyMinScore"));
    const thrivingMinScore = Number(formData.get("thrivingMinScore"));

    setIsUpdatingCareScoreRules(true);
    setError(null);

    try {
      const rules = await updateAdminCloudPetCareScoreRules(token, {
        dailyTaskBonus,
        steadyMinScore,
        thrivingMinScore,
        thrivingRequiresCareToday: formData.get("thrivingRequiresCareToday") === "on"
      });
      setCloudPetCareScoreRules(rules);
      await loadAdminData(token);
      setStatus("云养宠照护分规则已更新。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "照护分规则更新失败");
    } finally {
      setIsUpdatingCareScoreRules(false);
    }
  }

  async function handleGenerateDailyDiaries() {
    setIsGeneratingDailyDiaries(true);
    setError(null);

    try {
      const result = await generateCloudPetDailyDiaries(token);
      setDailyDiaryGeneration(result);
      await loadAdminData(token);
      setStatus(
        `今日云养宠日记已生成 ${result.generatedCount} 条，跳过 ${result.skippedCount} 条。`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "今日云养宠日记生成失败"
      );
    } finally {
      setIsGeneratingDailyDiaries(false);
    }
  }

  const webReleaseAttention = deploymentReadiness
    ? getCloudPetWebReleaseAttention(webRelease, deploymentReadiness.release)
    : [];
  const effectiveLaunchAttentionItems = cloudPetLaunchReadiness
    ? [
        ...cloudPetLaunchReadiness.attentionItems.map((item) => ({
          kind: "backend" as const,
          code: item.code
        })),
        ...webReleaseAttention.map((code) => ({
          kind: "web" as const,
          code
        }))
      ]
    : [];
  const effectiveLaunchStatus = cloudPetLaunchReadiness
    ? getCloudPetEffectiveLaunchStatus(
        cloudPetLaunchReadiness.status,
        webReleaseAttention
      )
    : "needs_attention";

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">商家后台</p>
          <h2>运营控制中心</h2>
          <p>统一管理商品、营销、履约、售后、云养宠和社区内容。</p>
        </div>
        <div className="admin-token-form">
          <button
            className="admin-button"
            onClick={() => void loadAdminData(token)}
            type="button"
          >
            刷新数据
          </button>
          <Link className="admin-button admin-button--ghost" href="/admin/payments">
            支付流水
          </Link>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            退出登录
          </button>
        </div>
        <p className={error ? "admin-status admin-status--error" : "admin-status"}>
          {error ?? status}
        </p>
      </section>

      <section className="admin-card" data-testid="admin-member-verification-metrics">
        <p className="section__kicker">会员认证</p>
        <h2>近 24 小时验证码漏斗</h2>
        <div className="admin-metrics">
          {[
            ["已发送", metrics?.memberVerificationIssuedCount ?? 0],
            ["验证成功", metrics?.memberVerificationSuccessCount ?? 0],
            ["等待验证", metrics?.memberVerificationActiveCount ?? 0],
            ["已过期", metrics?.memberVerificationExpiredCount ?? 0],
            ["已锁定", metrics?.memberVerificationLockedCount ?? 0],
            ["错误尝试", metrics?.memberVerificationFailedAttemptCount ?? 0],
            [
              "验证成功率",
              `${Math.round((metrics?.memberVerificationSuccessRate ?? 0) * 100)}%`
            ]
          ].map(([label, value]) => (
            <article className="admin-metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      {currentStaff?.role === "owner" ? (
        <section className="admin-card" data-testid="admin-cloud-pet-launch-readiness">
          <div className="admin-inline-actions">
            <div>
              <p className="section__kicker">云养宠上线检查</p>
              <h2>内置上线检查</h2>
            </div>
            <button
              className="admin-button admin-button--ghost"
              data-testid="admin-cloud-pet-launch-readiness-refresh"
              disabled={cloudPetLaunchReadinessLoading}
              onClick={() =>
                void loadCloudPetLaunchReadiness(token, currentStaff?.role)
              }
              type="button"
            >
              {cloudPetLaunchReadinessLoading ? "刷新中..." : "刷新状态"}
            </button>
          </div>
          {cloudPetLaunchReadinessLoading && !cloudPetLaunchReadiness ? (
            <p
              className="admin-status"
              data-testid="admin-cloud-pet-launch-readiness-loading"
            >
              正在加载上线检查...
            </p>
          ) : null}
          {cloudPetLaunchReadinessError ? (
            <div
              className="admin-status admin-status--error"
              data-testid="admin-cloud-pet-launch-readiness-error"
            >
              <span>{cloudPetLaunchReadinessError}</span>
              <button
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void loadCloudPetLaunchReadiness(token, currentStaff?.role)
                }
                type="button"
              >
                重新加载
              </button>
            </div>
          ) : null}
          {cloudPetLaunchReadiness ? (
            <>
              <div
                className={
                  effectiveLaunchStatus === "passed"
                    ? "admin-status"
                    : "admin-status admin-status--error"
                }
                data-testid="admin-cloud-pet-launch-readiness-status"
              >
                {effectiveLaunchStatus === "passed"
                  ? "内置上线检查：已通过"
                  : "内置上线检查：需要处理"}
              </div>
              <div className="admin-metrics">
                {[
                  [
                    "API / 运行环境",
                    cloudPetLaunchReadiness.checks.runtime === "passed" ? "正常" : "需要处理"
                  ],
                  [
                    "运行状态",
                    cloudPetLaunchReadiness.checks.runtime === "passed" ? "正常" : "需要处理"
                  ],
                  [
                    "数据备份",
                    cloudPetLaunchReadiness.checks.dataProtection === "passed" ? "已验证且新鲜" : "需要处理"
                  ],
                  [
                    "自动保护",
                    cloudPetLaunchReadiness.checks.automation === "passed" ? "无失败抑制" : "失败抑制中"
                  ]
                ].map(([label, value]) => (
                  <article className="admin-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              {effectiveLaunchAttentionItems.length > 0 ? (
                <ul className="admin-list" data-testid="admin-cloud-pet-launch-readiness-attention">
                  {effectiveLaunchAttentionItems.map(({ kind, code }) => {
                    const target =
                      kind === "web"
                        ? { href: "#admin-deployment-readiness", label: "查看部署状态" }
                        : getCloudPetLaunchReadinessAttentionTarget(code);
                    const label =
                      kind === "web"
                        ? getCloudPetWebReleaseAttentionLabel(code)
                        : getCloudPetLaunchReadinessAttentionLabel(code);
                    return (
                      <li key={`${kind}-${code}`}>
                        <span>{label}</span>{" "}
                        <a
                          className="admin-button admin-button--small admin-button--ghost"
                          data-testid={`admin-cloud-pet-launch-readiness-link-${code}`}
                          href={target.href}
                        >
                          {target.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <p className="admin-status" data-testid="admin-cloud-pet-launch-readiness-checked-at">
                最近检查：{new Date(cloudPetLaunchReadiness.checkedAt).toLocaleString()}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {currentStaff?.role === "owner" ? (
        <section
          className="admin-card"
          data-testid="admin-deployment-readiness"
          id="admin-deployment-readiness"
        >
          <div className="admin-inline-actions">
            <div>
              <p className="section__kicker">上线检查</p>
              <h2>生产部署状态</h2>
            </div>
            <button
              className="admin-button admin-button--ghost"
              data-testid="admin-deployment-readiness-refresh"
              disabled={deploymentReadinessLoading}
              onClick={() =>
                void loadDeploymentReadiness(token, currentStaff?.role)
              }
              type="button"
            >
              {deploymentReadinessLoading ? "刷新中..." : "刷新状态"}
            </button>
          </div>
          {deploymentReadinessLoading && !deploymentReadiness ? (
            <p className="admin-status" data-testid="admin-deployment-readiness-loading">
              正在加载生产部署状态...
            </p>
          ) : null}
          {deploymentReadinessError ? (
            <div
              className="admin-status admin-status--error"
              data-testid="admin-deployment-readiness-error"
            >
              <span>{deploymentReadinessError}</span>
              <button
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void loadDeploymentReadiness(token, currentStaff?.role)
                }
                type="button"
              >
                重新加载
              </button>
            </div>
          ) : null}
          {deploymentReadiness ? (
            <>
              <div
                className={
                  deploymentReadiness.status === "ready"
                    ? "admin-status"
                    : "admin-status admin-status--error"
                }
                data-testid="admin-deployment-readiness-status"
              >
                {deploymentReadiness.status === "ready"
                  ? "当前实例已按生产模式运行"
                  : "需要关注：当前部署配置需要运维检查"}
              </div>
              <div className="admin-metrics">
                {[
                  ["运行环境", deploymentReadiness.runtime.production ? "Production" : "非 Production"],
                  [
                    "数据持久化",
                    deploymentReadiness.persistence.mode === "prisma_sqlite"
                      ? "Prisma / SQLite"
                      : deploymentReadiness.persistence.mode === "memory"
                        ? "内存模式"
                        : "无法确认"
                  ],
                  [
                    "数据库",
                    deploymentReadiness.persistence.databaseReady ? "正常" : "不可用"
                  ],
                  [
                    "管理员认证",
                    deploymentReadiness.configuration.adminAuthConfigured ? "已配置" : "未配置"
                  ],
                  [
                    "会员验证码",
                    deploymentReadiness.configuration.memberWebhookConfigured ? "已配置" : "未配置"
                  ],
                  [
                    "HTTP 安全配置",
                    deploymentReadiness.configuration.corsConfigured &&
                    deploymentReadiness.configuration.trustedProxyConfigured &&
                    deploymentReadiness.configuration.requestBodyLimitConfigured
                      ? "已配置"
                      : "未配置"
                  ],
                  [
                    "运维指标",
                    deploymentReadiness.configuration.opsMetricsConfigured ? "已配置" : "未配置"
                  ],
                  [
                    "数据保护状态目录",
                    deploymentReadiness.configuration.recoveryStatusDirectoryConfigured
                      ? "已配置"
                      : "未配置"
                  ],
                  [
                    "生产安全配置基线",
                    getCloudPetConfigBaselineLabel(deploymentReadiness.configBaseline.status)
                  ],
                  [
                    "当前发布",
                    getCloudPetReleaseLabel(deploymentReadiness.release)
                  ],
                  ["Web 发布", webRelease.id ?? "未标识"],
                  [
                    "Web 与 API 发布",
                    getCloudPetWebApiReleaseLabel(
                      compareCloudPetWebApiRelease(webRelease, deploymentReadiness.release)
                    )
                  ],
                  [
                    "数据库迁移",
                    getCloudPetMigrationCompatibilityLabel(
                      deploymentReadiness.migrationCompatibility.status
                    )
                  ]
                ].map(([label, value]) => (
                  <article className="admin-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {currentStaff?.role === "owner" ? (
        <section
          className="admin-card"
          data-testid="admin-cloud-pet-ops-health"
          id="admin-cloud-pet-health"
        >
          <div className="admin-inline-actions">
            <div>
              <p className="section__kicker">系统运维</p>
              <h2>云养宠系统运行状态</h2>
            </div>
            <button
              className="admin-button admin-button--ghost"
              data-testid="admin-cloud-pet-ops-health-refresh"
              disabled={cloudPetOpsHealthLoading}
              onClick={() =>
                void loadCloudPetOpsHealth(token, currentStaff?.role)
              }
              type="button"
            >
              {cloudPetOpsHealthLoading ? "刷新中..." : "刷新状态"}
            </button>
          </div>

          {cloudPetOpsHealthLoading && !cloudPetOpsHealth ? (
            <p className="admin-status" data-testid="admin-cloud-pet-ops-health-loading">
              正在加载系统运行状态...
            </p>
          ) : null}
          {cloudPetOpsHealthError ? (
            <div className="admin-status admin-status--error" data-testid="admin-cloud-pet-ops-health-error">
              <span>{cloudPetOpsHealthError}</span>
              <button
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void loadCloudPetOpsHealth(token, currentStaff?.role)
                }
                type="button"
              >
                重新加载
              </button>
            </div>
          ) : null}
          {cloudPetOpsHealth ? (
            <>
              <div
                className={
                  cloudPetOpsHealth.status === "healthy"
                    ? "admin-status"
                    : "admin-status admin-status--error"
                }
                data-testid="admin-cloud-pet-ops-health-status"
              >
                {cloudPetOpsHealth.status === "healthy"
                  ? "系统运行正常"
                  : "系统需要关注"}
              </div>
              <div className="admin-metrics">
                {[
                  ["近 5 分钟请求", cloudPetOpsHealth.http.requestCount],
                  ["5xx 数量", cloudPetOpsHealth.http.serverErrorCount],
                  [
                    "5xx 比率",
                    `${Math.round(cloudPetOpsHealth.http.serverErrorRate * 100)}%`
                  ],
                  ["429 数量", cloudPetOpsHealth.http.rateLimitedCount],
                  [
                    "今日日记覆盖率",
                    cloudPetOpsHealth.cloudPet.dailyDiary
                      ? `${Math.round(
                          cloudPetOpsHealth.cloudPet.dailyDiary.coverageRate * 100
                        )}%`
                      : "—"
                  ],
                  [
                    "今日日记缺失",
                    cloudPetOpsHealth.cloudPet.dailyDiary?.missingCount ?? "—"
                  ],
                  [
                    "待处理举报",
                    cloudPetOpsHealth.cloudPet.communityModeration?.openReportCount ?? "—"
                  ]
                ].map(([label, value]) => (
                  <article className="admin-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              {cloudPetOpsHealth.cloudPet.dailyDiary &&
              cloudPetOpsHealth.cloudPet.dailyDiary.missingCount > 0 ? (
                <Link
                  className="admin-button admin-button--small admin-button--ghost"
                  data-testid="admin-health-diary-gap-link"
                  href={`/admin/pets/daily-diary-coverage?date=${encodeURIComponent(
                    cloudPetOpsHealth.cloudPet.dailyDiary.date
                  )}`}
                >
                  查看日记缺口
                </Link>
              ) : null}
              {cloudPetOpsHealth.cloudPet.communityModeration &&
              cloudPetOpsHealth.cloudPet.communityModeration.openReportCount > 0 ? (
                <Link
                  className="admin-button admin-button--small admin-button--ghost"
                  data-testid="admin-health-pending-reports-link"
                  href="/admin?reportStatus=pending_review#admin-community-reports"
                >
                  查看待处理举报
                </Link>
              ) : null}
              <p className="admin-status" data-testid="admin-cloud-pet-ops-health-updated-at">
                数据更新时间：{new Date(cloudPetOpsHealth.timestamp).toLocaleString()}
              </p>
            </>
          ) : null}
        </section>
      ) : null}

      {currentStaff?.role === "owner" ? (
        <section
          className="admin-card"
          data-testid="admin-sqlite-recovery-status"
          id="admin-data-protection"
        >
          <div className="admin-inline-actions">
            <div>
              <p className="section__kicker">数据保护</p>
              <h2>SQLite 备份与恢复状态</h2>
            </div>
            <button
              className="admin-button admin-button--ghost"
              data-testid="admin-sqlite-recovery-status-refresh"
              disabled={sqliteRecoveryStatusLoading || sqliteRecoveryRunLoading}
              onClick={() =>
                void loadSqliteRecoveryStatus(token, currentStaff?.role)
              }
              type="button"
            >
              {sqliteRecoveryStatusLoading ? "刷新中..." : "刷新状态"}
            </button>
            <button
              className="admin-button"
              data-testid="admin-sqlite-recovery-run"
              disabled={sqliteRecoveryStatusLoading || sqliteRecoveryRunLoading}
              onClick={() => void handleSqliteRecoveryRun()}
              type="button"
            >
              {sqliteRecoveryRunLoading ? "正在创建并验证..." : "创建并验证新备份"}
            </button>
          </div>
          {sqliteRecoveryStatus ? (
            <p className="admin-status" data-testid="admin-sqlite-recovery-auto-refresh">
              自动数据保护：{sqliteRecoveryStatus.autoRefreshEnabled ? "已启用" : "未启用"}
            </p>
          ) : null}
          {sqliteRecoveryStatus?.autoRefreshEnabled ? (
            <div
              className={
                sqliteRecoveryStatus.autoRefreshRuntime.suppressionActive
                  ? "admin-status admin-status--error"
                  : "admin-status"
              }
              data-testid="admin-sqlite-recovery-auto-refresh-runtime"
            >
              <p>
                {sqliteRecoveryStatus.autoRefreshRuntime.suppressionActive
                  ? "自动数据保护需要关注"
                  : "自动数据保护运行状态"}
              </p>
              <p>
                最近自动检查：
                {formatSqliteRecoveryAutoRefreshTimestamp(
                  sqliteRecoveryStatus.autoRefreshRuntime.lastCheckedAt
                )}
              </p>
              <p>
                最近结果：
                {getSqliteRecoveryAutoRefreshOutcomeLabel(
                  sqliteRecoveryStatus.autoRefreshRuntime.lastOutcome
                )}
                {sqliteRecoveryStatus.autoRefreshRuntime.reasonCode
                  ? `（${sqliteRecoveryStatus.autoRefreshRuntime.reasonCode}）`
                  : ""}
              </p>
              {sqliteRecoveryStatus.autoRefreshRuntime.suppressionActive ? (
                <p>本进程后续自动执行已暂停，请由 Owner 关注并处理。</p>
              ) : null}
              {sqliteRecoveryStatus.autoRefreshRuntime.nextCheckAt ? (
                <p>
                  下一次检查：
                  {formatSqliteRecoveryAutoRefreshTimestamp(
                    sqliteRecoveryStatus.autoRefreshRuntime.nextCheckAt
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {sqliteRecoveryStatusLoading && !sqliteRecoveryStatus ? (
            <p
              className="admin-status"
              data-testid="admin-sqlite-recovery-status-loading"
            >
              正在加载数据保护状态...
            </p>
          ) : null}
          {sqliteRecoveryStatusError ? (
            <div
              className="admin-status admin-status--error"
              data-testid="admin-sqlite-recovery-status-error"
            >
              <span>{sqliteRecoveryStatusError}</span>
              <button
                className="admin-button admin-button--ghost"
                onClick={() =>
                  void loadSqliteRecoveryStatus(token, currentStaff?.role)
                }
                type="button"
              >
                重新加载
              </button>
            </div>
          ) : null}
          {sqliteRecoveryStatus ? (
            <>
              <div
                className={
                  sqliteRecoveryStatus.status === "recoverable"
                    ? "admin-status"
                    : sqliteRecoveryStatus.status === "drill_failed"
                      ? "admin-status admin-status--error"
                      : "admin-status"
                }
                data-testid="admin-sqlite-recovery-status-value"
              >
                {getSqliteRecoveryStatusLabel(sqliteRecoveryStatus.status)}
              </div>
              <p
                className={
                  sqliteRecoveryStatus.freshness === "stale"
                    ? "admin-status admin-status--error"
                    : "admin-status"
                }
                data-testid="admin-sqlite-recovery-freshness"
              >
                备份新鲜度：{getSqliteRecoveryFreshnessLabel(sqliteRecoveryStatus.freshness)}
                {sqliteRecoveryStatus.maxBackupAgeHours
                  ? `（允许最大 ${sqliteRecoveryStatus.maxBackupAgeHours} 小时）`
                  : ""}
              </p>
              {sqliteRecoveryStatus.latestBackup ? (
                <p className="admin-status">
                  最新备份：{new Date(sqliteRecoveryStatus.latestBackup.createdAt).toLocaleString()}（{formatAgeSeconds(
                    sqliteRecoveryStatus.latestBackup.ageSeconds
                  )}）
                </p>
              ) : null}
              {sqliteRecoveryStatus.latestRestoreDrill ? (
                <p className="admin-status">
                  最近恢复演练：{new Date(sqliteRecoveryStatus.latestRestoreDrill.checkedAt).toLocaleString()}
                  {sqliteRecoveryStatus.latestRestoreDrill.failureCode
                    ? `（${sqliteRecoveryStatus.latestRestoreDrill.failureCode}）`
                    : ""}
                </p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      <section className="admin-card">
        <p className="section__kicker">员工权限</p>
        <h2>当前员工与权限</h2>
        <div className="admin-row">
          <div>
            <strong>{currentStaff ? getAdminStaffNameLabel(currentStaff.name) : "尚未加载"}</strong>
            <span>
              {currentStaff?.staffNo ?? "STAFF_UNKNOWN"} /{" "}
              {currentStaff ? getAdminRoleLabel(currentStaff.role) : "未知角色"}
            </span>
          </div>
          <em>{currentStaff?.permissions.length ?? 0} 项权限</em>
        </div>
        <div className="admin-inventory-alerts">
          {(currentStaff?.permissions ?? []).map((permission) => (
            <span key={permission} title={permission}>{getPermissionLabel(permission)}</span>
          ))}
          {!currentStaff ? <span>刷新数据后可查看当前员工权限。</span> : null}
        </div>
      </section>

      <section className="admin-metrics">
        {[
          ["在售商品", metrics?.activeProductCount ?? 0],
          ["云养宠", metrics?.cloudPetCount ?? 0],
          ["今日日记已覆盖", metrics?.dailyDiaryCoveredCount ?? 0],
          ["今日日记缺失", metrics?.dailyDiaryMissingCount ?? 0],
          [
            "今日日记覆盖率",
            `${Math.round((metrics?.dailyDiaryCoverageRate ?? 0) * 100)}%`
          ],
          ["社区帖子", metrics?.communityPostCount ?? 0],
          ["低库存规格", metrics?.lowStockVariantCount ?? 0],
          ["订单", metrics?.orderCount ?? 0],
          ["待处理订单", metrics?.pendingOrderCount ?? 0],
          ["支付单", metrics?.paymentIntentCount ?? 0],
          ["待支付", metrics?.pendingPaymentIntentCount ?? 0],
          ["支付失败", metrics?.failedPaymentIntentCount ?? 0],
          ["支付逾期", metrics?.overduePaymentIntentCount ?? 0],
          ["待处理退款", metrics?.pendingRefundCount ?? 0],
          ["加急退款", metrics?.expeditedRefundCount ?? 0],
          ["受阻退款", metrics?.blockedRefundCount ?? 0],
          ["即将超时退款", metrics?.dueSoonRefundCount ?? 0],
          ["超时退款", metrics?.overdueRefundCount ?? 0],
          ["待退款金额", formatCents(metrics?.pendingRefundAmountCents ?? 0)],
          ["操作日志", metrics?.operationLogCount ?? 0],
          ["高风险操作", metrics?.highRiskOperationCount ?? 0],
          ["权限拒绝", metrics?.permissionDeniedCount ?? 0],
          ["已隐藏帖子", metrics?.hiddenCommunityPostCount ?? 0]
        ].map(([label, value]) => (
          <article className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-card">
        <p className="section__kicker">支付</p>
        <h2>支付风险队列</h2>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=failed">
            支付失败（{metrics?.failedPaymentIntentCount ?? 0}）
          </Link>
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=pending&overdue=true">
            支付逾期（{metrics?.overduePaymentIntentCount ?? 0}）
          </Link>
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=pending">
            待支付（{metrics?.pendingPaymentIntentCount ?? 0}）
          </Link>
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">经营分析</p>
        <h2>营收、复购与留存</h2>
        <div className="admin-metrics">
          {[
            ["成交总额", formatCents(analytics?.revenue.gmvCents ?? 0)],
            ["已支付订单", analytics?.revenue.paidOrderCount ?? 0],
            ["客单价", formatCents(analytics?.revenue.averageOrderValueCents ?? 0)],
            ["支付转化率", `${analytics?.conversion.paidOrderRate ?? 0}%`],
            ["复购客户", analytics?.customers.repeatCustomerCount ?? 0],
            ["复购率", `${analytics?.customers.repeatPurchaseRate ?? 0}%`]
          ].map(([label, value]) => (
            <article className="admin-metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="admin-list">
          <strong>热销商品规格</strong>
          {(analytics?.productRankings ?? []).map((item) => (
            <div className="admin-row" key={item.skuCode}>
              <div>
                <strong>{getProductTitleLabel(item.title)}</strong>
                <span>
                  {item.skuCode} / 售出 {item.quantitySold} / 销售额{" "}
                  {formatCents(item.revenueCents)}
                </span>
              </div>
            </div>
          ))}
          {analytics?.productRankings.length === 0 ? (
            <p className="admin-muted">暂无已支付订单的商品排行。</p>
          ) : null}
        </div>
        <div className="admin-list">
          <strong>转化漏斗</strong>
          {(analytics?.retentionFunnel ?? []).map((stage) => {
            const copy = getRetentionFunnelCopy(stage);
            return (
            <div className="admin-row" key={stage.key}>
              <div>
                <strong>
                  {copy.title} / {stage.count} 位会员
                </strong>
                <span>
                  转化率：{stage.conversionRate}% / 流失：{" "}
                  {stage.dropOffCount}
                </span>
                <span>建议动作：{copy.actionLabel}</span>
              </div>
            </div>
            );
          })}
          {(analytics?.retentionFunnel ?? []).length === 0 ? (
            <p className="admin-muted">暂无转化漏斗数据。</p>
          ) : null}
        </div>
        <div className="admin-inventory-alerts">
          <strong>留存信号</strong>
          <span>云养宠：{analytics?.retentionSignals.cloudPetCount ?? 0}</span>
          <span>主页访问：{analytics?.retentionSignals.homepageVisitCount ?? 0}</span>
          <span>社区帖子：{analytics?.retentionSignals.communityPostCount ?? 0}</span>
          <span>商品评价：{analytics?.retentionSignals.reviewCount ?? 0}</span>
          <span>待审核评价：{analytics?.retentionSignals.pendingReviewCount ?? 0}</span>
          <span>
            待处理举报：{" "}
            {analytics?.retentionSignals.pendingCommunityReportCount ?? 0}
          </span>
        </div>
        <div className="admin-list">
          <strong>客户分群</strong>
          {(analytics?.customerSegments ?? []).map((segment) => {
            const copy = getCustomerSegmentCopy(segment);
            return (
            <div className="admin-row" key={segment.key}>
              <div>
                <strong>
                  {copy.title} / {segment.memberCount} 位会员
                </strong>
                <span>{copy.description}</span>
                <span>
                  建议动作：{copy.actionLabel} / 优先级：{getPriorityLabel(segment.priority)}
                </span>
                <span>
                  样本手机号：{" "}
                  {segment.samplePhones.length > 0 ? segment.samplePhones.join(", ")
                    : "暂无匹配会员"}
                </span>
              </div>
            </div>
            );
          })}
          {(analytics?.customerSegments ?? []).length === 0 ? (
            <p className="admin-muted">暂无客户分群数据。</p>
          ) : null}
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">客户管理</p>
        <h2>客户档案与跟进动作</h2>
        {currentStaff && !canManageCustomers ? (
          <p className="admin-permission-note">
            当前员工只能查看客户数据；标记客户或记录跟进需要客户管理权限。
          </p>
        ) : null}
        <div className="admin-list">
          {customers.slice(0, 8).map((customer) => (
            <div className="admin-row" key={customer.phone}>
              <div>
                <strong>
                  {customer.name} / {customer.phone}
                </strong>
                <span>
                  已支付订单：{customer.paidOrderCount} / 销售额：{" "}
                  {formatCents(customer.totalPaidCents)} / 宠物：{customer.petCount} /
                  帖子：{customer.communityPostCount}
                </span>
                <span>
                  标签：{" "}
                  {customer.tags.length > 0 ? customer.tags.map(getCustomerTagLabel).join("、")
                    : "暂无标签"}
                </span>
                <span>
                  下一步动作：{customer.nextBestAction.title} /{" "}
                  {customer.nextBestAction.ctaLabel}
                </span>
              </div>
              <div className="admin-actions">
                <button
                  disabled={!canManageCustomers || busyCustomerPhone === customer.phone}
                  onClick={() => void handleMarkCustomerVip(customer)}
                  title={
                    canManageCustomers ? undefined
                      : "缺少 customers:write 权限"
                  }
                  type="button"
                >
                  标记 VIP
                </button>
                <button
                  disabled={!canManageCustomers || busyCustomerPhone === customer.phone}
                  onClick={() => void handleCustomerFollowUp(customer)}
                  title={
                    canManageCustomers ? undefined
                      : "缺少 customers:write 权限"
                  }
                  type="button"
                >
                  记录跟进
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 ? (
            <p className="admin-muted">暂无客户档案。</p>
          ) : null}
        </div>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <p className="section__kicker">审计追踪</p>
          <h2>近期操作日志</h2>
          <div className="admin-list">
            {operationLogs.map((log) => (
              <div
                className="admin-row"
                data-action={log.action}
                data-staff-name={log.staffName}
                data-staff-role={log.role}
                data-target-id={log.targetId}
                data-target-type={log.targetType}
                data-testid="admin-operation-log-item"
                key={log.logNo}
              >
                <div>
                  <strong>{getOperationActionLabel(log.action)}</strong>
                  <span>
                    {getAdminStaffNameLabel(log.staffName)} / {getOperationTargetLabel(log.targetType)}：{log.targetId}
                  </span>
                </div>
                <em>{new Date(log.createdAt).toLocaleString()}</em>
              </div>
            ))}
            {operationLogs.length === 0 ? (
              <p className="admin-muted">
                当前员工角色暂无可查看的操作日志。
              </p>
            ) : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">内容自动化</p>
          <h2>首页与活动内容块</h2>
          <form className="admin-create-product" onSubmit={(event) => void handleCreateCmsBlock(event)}>
            <label>
              投放位置键
              <input defaultValue="homepage.campaign" name="slotKey" required />
            </label>
            <label>
              状态
              <select defaultValue="published" name="status">
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="archived">已归档</option>
              </select>
            </label>
            <label>
              排序值
              <input defaultValue="1" min={0} name="sortOrder" type="number" />
            </label>
            <label className="admin-create-product__wide">
              标题
              <input defaultValue="今日云养宠成长活动" name="title" required />
            </label>
            <label className="admin-create-product__wide">
              正文
              <textarea
                defaultValue="把今日日记、成长任务和商城推荐整合成一个首页内容块。"
                name="body"
                required
                rows={3}
              />
            </label>
            <label>
              按钮文案
              <input defaultValue="前往商城" name="ctaLabel" />
            </label>
            <label>
              链接
              <input defaultValue="/shop" name="href" />
            </label>
            <label className="admin-create-product__wide">
              图片地址
              <input defaultValue="/brand/naigai-niangao/naigai-standard.png" name="imageUrl" />
            </label>
            <button className="admin-button admin-create-product__wide" disabled={isCreatingCmsBlock} type="submit">
              {isCreatingCmsBlock ? "发布中..." : "创建内容块"}
            </button>
          </form>
          <div className="admin-list">
            {cmsBlocks.map((block) => (
              <div className="admin-row" key={block.blockNo}>
                <div>
                  <strong>{block.title}</strong>
                  <span>
                    {block.slotKey} / {getStatusLabel(block.status)} / 排序 {block.sortOrder}
                  </span>
                </div>
                <button
                  className="admin-button admin-button--small"
                  disabled={busyCmsBlockNo === block.blockNo}
                  onClick={() =>
                    void handleCmsBlockStatus(
                      block.blockNo,
                      block.status === "published" ? "archived" : "published"
                    )
                  }
                  type="button"
                >
                  {block.status === "published" ? "归档" : "发布"}
                </button>
              </div>
            ))}
            {cmsBlocks.length === 0 ? <p className="admin-muted">暂无内容块。</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">营销中心</p>
          <h2>优惠券活动</h2>
          <div className="admin-list">
            {coupons.map((coupon) => (
              <div className="admin-row" key={coupon.code}>
                <div>
                  <strong>{coupon.code}</strong>
                  <span>
                    {getStatusLabel(coupon.status)} / 优惠 {formatCents(coupon.discountValueCents)} / 门槛{" "}
                    {formatCents(coupon.minSpendCents)} / 已使用 {coupon.usageCount}
                    {coupon.usageLimitPerMember ? ` / 每人限用 ${coupon.usageLimitPerMember} 次`
                      : ""}
                  </span>
                </div>
                <button
                  className="admin-button admin-button--small"
                  disabled={busyCouponCode === coupon.code}
                  onClick={() =>
                    void handleCouponStatus(
                      coupon.code,
                      coupon.status === "active" ? "paused" : "active"
                    )
                  }
                  type="button"
                >
                  {coupon.status === "active" ? "暂停优惠券" : "启用优惠券"}
                </button>
              </div>
            ))}
            {coupons.length === 0 ? <p className="admin-muted">暂无优惠券。</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">售后</p>
          <h2>退款申请</h2>
          <div className="admin-list">
            {refunds.map((refund) => (
              <div className="admin-order" key={refund.refundNo}>
                <div>
                  <strong>{refund.refundNo}</strong>
                  <span>
                    {getStatusLabel(refund.status)} / {refund.orderNo} / {formatCents(refund.requestedAmountCents)}
                  </span>
                </div>
                <div className="admin-refund-context">
                  <span>
                    可退款余额{" "}
                    {formatCents(refund.refundableBalanceCents ?? refund.requestedAmountCents)}
                  </span>
                  <span>
                    申请后余额{" "}
                    {formatCents(refund.remainingAfterRequestCents ?? 0)}
                  </span>
                  {refund.reviewRisk ? (
                    <strong className={`admin-risk admin-risk--${refund.reviewRisk.level}`}>
                      风险 {getRiskLevelLabel(refund.reviewRisk.level)} / 优先级 {getRiskLevelLabel(refund.reviewRisk.priority)}：{" "}
                      {refund.reviewRisk.reason}
                    </strong>
                  ) : null}
                  {refund.reviewSla ? (
                    <strong className={`admin-risk admin-risk--${getSlaRiskLevel(refund.reviewSla.status)}`}>
                      SLA {getStatusLabel(refund.reviewSla.status)}：剩余 {refund.reviewSla.hoursUntilDue} 小时 / 截止{" "}
                      {new Date(refund.reviewSla.dueAt).toLocaleString()}
                    </strong>
                  ) : null}
                </div>
                <p>{refund.reason}</p>
                {refund.status === "pending_review" ? (
                  <div className="admin-inline-actions">
                    <button
                      className="admin-button admin-button--small"
                      disabled={busyRefundNo === refund.refundNo}
                      onClick={() => void handleRefundStatus(refund.refundNo, "approved")}
                      type="button"
                    >
                      通过退款
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyRefundNo === refund.refundNo}
                      onClick={() => void handleRefundStatus(refund.refundNo, "rejected")}
                      type="button"
                    >
                      拒绝
                    </button>
                  </div>
                ) : (
                  <em>{refund.note ?? "已处理"}</em>
                )}
              </div>
            ))}
            {refunds.length === 0 ? <p className="admin-muted">暂无退款申请。</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">评价审核</p>
          <h2>商品评价</h2>
          <div className="admin-list">
            {reviews.map((review) => (
              <div className="admin-order" key={review.reviewNo}>
                <div>
                  <strong>{review.reviewNo}</strong>
                  <span>
                    {getStatusLabel(review.status) + " / " + review.productSlug + " / " + review.rating + " 星"}
                  </span>
                </div>
                <p>{review.body}</p>
                <div className="admin-inline-actions">
                  <button
                    className="admin-button admin-button--small"
                    disabled={busyReviewNo === review.reviewNo}
                    onClick={() => void handleReviewStatus(review.reviewNo, "visible")}
                    type="button"
                  >
                    展示
                  </button>
                  <button
                    className="admin-button admin-button--small admin-button--ghost"
                    disabled={busyReviewNo === review.reviewNo}
                    onClick={() => void handleReviewStatus(review.reviewNo, "hidden")}
                    type="button"
                  >
                    隐藏
                  </button>
                </div>
              </div>
            ))}
            {reviews.length === 0 ? <p className="admin-muted">暂无评价。</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">商品运营</p>
          <h2>商品与库存</h2>
          <form className="admin-create-product" onSubmit={(event) => void handleCreateProduct(event)}>
            <label>
              商品标识
              <input defaultValue="merchant-training-ball" name="slug" required />
            </label>
            <label>
              商品名称
              <input defaultValue="商家训练球" name="title" required />
            </label>
            <label>
              适用宠物
              <select defaultValue="dog" name="petType">
                <option value="dog">狗</option>
                <option value="cat">猫</option>
                <option value="both">猫狗通用</option>
              </select>
            </label>
            <label>
              玩具类型
              <input defaultValue="training" name="toyType" required />
            </label>
            <label className="admin-create-product__wide">
              商品描述
              <textarea
                defaultValue="用于商品运营演示的商家自建玩具。"
                name="description"
                required
                rows={2}
              />
            </label>
            <label>
              图片地址
              <input defaultValue="/brand/naigai-niangao/niangao-toy.png" name="imageUrl" required />
            </label>
            <label>
              商品规格编号
              <input defaultValue={`MTB-${Date.now().toString().slice(-5)}`} name="skuCode" required />
            </label>
            <label>
              规格名称
              <input defaultValue="红色 / 小号" name="variantName" required />
            </label>
            <label>
              颜色
              <input defaultValue="红色" name="color" />
            </label>
            <label>
              尺寸
              <input defaultValue="S" name="size" />
            </label>
            <label>
              材质
              <input defaultValue="橡胶" name="material" />
            </label>
            <label>
              价格
              <input defaultValue="25.90" min="0.01" name="priceYuan" step="0.01" type="number" />
            </label>
            <label>
              库存
              <input defaultValue="3" min={0} name="stock" type="number" />
            </label>
            <button className="admin-button admin-create-product__wide" disabled={isCreatingProduct} type="submit">
              {isCreatingProduct ? "创建中..." : "创建并上架商品"}
            </button>
          </form>
          <div className="admin-inventory-alerts">
            <strong>低库存提醒</strong>
            {lowStock.map((variant) => (
              <span key={`${variant.productSlug}-${variant.skuCode}`}>
                {variant.skuCode}: {variant.stock}/{variant.threshold}
              </span>
            ))}
            {lowStock.length === 0 ? <span>暂无低库存规格。</span> : null}
          </div>
          <div className="admin-list">
            {products.map((product) => (
              <div className="admin-product" key={product.slug}>
                <div>
                  <strong>{getProductTitleLabel(product.title)}</strong>
                  <span>{product.slug + " / " + getStatusLabel(product.status)}</span>
                </div>
                {product.variants.map((variant) => (
                  <form
                    className="admin-inline-form"
                    key={variant.skuCode}
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      void handleStockUpdate(
                        variant.skuCode,
                        String(formData.get("stock") ?? variant.stock)
                      );
                    }}
                  >
                    <label>
                      {variant.skuCode}
                      <input
                        defaultValue={variant.stock}
                        min={0}
                        name="stock"
                        type="number"
                      />
                    </label>
                    <button
                      className="admin-button admin-button--small"
                      disabled={busyProductKey === variant.skuCode}
                      type="submit"
                    >
                      更新库存
                    </button>
                  </form>
                ))}
                <button
                  className="admin-button admin-button--small"
                  disabled={busyProductKey === product.slug}
                  onClick={() =>
                    void handleProductStatus(
                      product.slug,
                      product.status === "active" ? "archived" : "active"
                    )
                  }
                  type="button"
                >
                  {product.status === "active" ? "下架商品" : "上架商品"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">履约</p>
          <h2>订单履约</h2>
          <div className="admin-list">
            {orders.map((order) => (
              <div className="admin-order" key={order.orderNo}>
                <div>
                  <strong>{order.orderNo}</strong>
                  <span>{getStatusLabel(order.status)}{" / "}{formatCents(order.totalCents)}</span>
                </div>
                <form
                  className="admin-inline-form"
                  onSubmit={(event) => void handleFulfillment(order.orderNo, event)}
                >
                  <label>
                    承运商
                    <input defaultValue="顺丰速运" name="carrier" required />
                  </label>
                  <label>
                    运单号
                    <input
                      defaultValue={`SF${order.orderNo.slice(-10)}`}
                      name="trackingNumber"
                      required
                    />
                  </label>
                  <button
                    className="admin-button admin-button--small"
                    disabled={
                      Boolean(order.shipment) || busyOrderNo === order.orderNo
                    }
                    type="submit"
                  >
                    {order.shipment ? "物流已登记" : "登记物流"}
                  </button>
                </form>
                {order.shipment ? (
                  <div className="admin-inline-actions">
                    <span>
                      {order.shipment.carrier} / {order.shipment.trackingNumber} /{" "}
                      {getStatusLabel(order.shipment.status)}
                    </span>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyOrderNo === order.orderNo}
                      onClick={() => void handleShipmentEvent(order.orderNo, "out_for_delivery")}
                      type="button"
                    >
                      标记派送中
                    </button>
                    <button
                      className="admin-button admin-button--small"
                      disabled={
                        order.status === "completed" || busyOrderNo === order.orderNo
                      }
                      onClick={() => void handleShipmentEvent(order.orderNo, "delivered")}
                      type="button"
                    >
                      标记已签收
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyOrderNo === order.orderNo}
                      onClick={() => void handleShipmentEvent(order.orderNo, "exception")}
                      type="button"
                    >
                      标记异常
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {orders.length === 0 ? <p className="admin-muted">暂无订单。</p> : null}
          </div>
        </article>

        <article className="admin-card" id="admin-cloud-pets">
          <p className="section__kicker">云养宠</p>
          <h2>云养宠档案</h2>
          <div className="admin-inline-actions">
            <button
              className="admin-button admin-button--small admin-button--ghost"
              data-testid="admin-cloud-pet-refresh"
              disabled={cloudPetRefreshing}
              onClick={() => void handleRefreshCloudPets()}
              type="button"
            >
              {cloudPetRefreshing ? "刷新中..." : "刷新云养宠数据"}
            </button>
            {cloudPetLastSuccessfulRefreshAt ? (
              <span data-testid="admin-cloud-pet-last-refresh">
                最近更新：{cloudPetLastSuccessfulRefreshAt.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </span>
            ) : null}
            <button
              className="admin-button"
              disabled={isGeneratingDailyDiaries}
              onClick={() => void handleGenerateDailyDiaries()}
              type="button"
            >
              {isGeneratingDailyDiaries ? "正在生成今日日记..."
                : "生成今日日记"}
            </button>
            {dailyDiaryGeneration ? (
              <span>
                {dailyDiaryGeneration.date}：已生成 {dailyDiaryGeneration.generatedCount} 条 /{" "}
                跳过 {dailyDiaryGeneration.skippedCount} 条
              </span>
            ) : null}
            <Link
              className="admin-button admin-button--small admin-button--ghost"
              href="/admin/pets/daily-diary-coverage"
            >
              查看缺口
            </Link>
          </div>
          {dailyDiaryStatus ? (
            <div className="admin-inventory-alerts">
              <strong>
                今日日记覆盖率{" "}
                {Math.round(dailyDiaryStatus.coverageRate * 100)}%
              </strong>
              <span>
                {dailyDiaryStatus.date}: {dailyDiaryStatus.generatedTodayCount}/
                {dailyDiaryStatus.totalPetCount} 已覆盖
              </span>
              <span>{dailyDiaryStatus.missingTodayCount} 条缺失</span>
              {dailyDiaryStatus.items
                .filter((item) => item.status === "missing")
                .slice(0, 3)
                .map((item) => (
                  <span key={item.petNo}>缺失：{item.name}</span>
                ))}
            </div>
          ) : null}
          {cloudPetRetentionMetrics ? (
            <div className="admin-inventory-alerts" data-testid="admin-cloud-pet-retention-metrics">
              <strong>
                今日照护完成率 {Math.round(cloudPetRetentionMetrics.careCompletionRate * 100)}%
              </strong>
              <span>
                今日已照护 {cloudPetRetentionMetrics.careCompletedTodayCount}/{cloudPetRetentionMetrics.totalPetCount}
              </span>
              <span>平均照护分 {cloudPetRetentionMetrics.averageCareScore}</span>
              <span>最长连续照护 {cloudPetRetentionMetrics.maxCareStreakDays} 天</span>
              <span>
                状态：{cloudPetRetentionMetrics.careStateCounts.needsCare} 只需要照护 / {cloudPetRetentionMetrics.careStateCounts.steady} 只稳定 / {cloudPetRetentionMetrics.careStateCounts.thriving} 只状态良好
              </span>
              <span>
                互动：{cloudPetRetentionMetrics.homepageVisitCount} 次访问 / {cloudPetRetentionMetrics.communityPostCount} 条帖子 / {cloudPetRetentionMetrics.pendingCommunityReportCount} 条待处理举报
              </span>
            </div>
          ) : null}
          {cloudPetGrowthTaskOperations ? (
            <div className="admin-inventory-alerts" data-testid="admin-cloud-pet-growth-tasks">
              <strong>成长任务配置</strong>
              <span>已跟踪 {cloudPetGrowthTaskOperations.totalPetCount} 只云养宠</span>
              {cloudPetGrowthTaskOperations.items.slice(0, 6).map((task) => (
                <form
                  className="admin-inline-form admin-cloud-pet-growth-task-form"
                  data-testid="admin-cloud-pet-growth-task-form"
                  key={task.key}
                  onSubmit={(event) => void handleUpdateGrowthTaskTemplate(event, task.key)}
                >
                  <span>
                    {getGrowthTaskCopy(task).title}：今日完成 {task.completedTodayCount} 次 / {Math.round(task.completionRate * 100)}%
                  </span>
                  <label>
                    成长积分
                    <input defaultValue={task.points} max="100" min="0" name="points" type="number" />
                  </label>
                  <label>
                    心情
                    <input defaultValue={task.rewards.mood} max="50" min="0" name="mood" type="number" />
                  </label>
                  <label>
                    精力
                    <input defaultValue={task.rewards.energy} max="50" min="0" name="energy" type="number" />
                  </label>
                  <label>
                    亲密度
                    <input defaultValue={task.rewards.intimacy} max="50" min="0" name="intimacy" type="number" />
                  </label>
                  <button
                    className="admin-button"
                    disabled={!canManageCloudPets || busyGrowthTaskKey === task.key}
                    type="submit"
                  >
                    {busyGrowthTaskKey === task.key ? "保存中..." : "保存配置"}
                  </button>
                </form>
              ))}
            </div>
          ) : null}
          {cloudPetCareScoreRules ? (
            <form
              className="admin-inline-form admin-cloud-pet-care-rules"
              data-testid="admin-cloud-pet-care-score-rules-form"
              onSubmit={(event) => void handleUpdateCareScoreRules(event)}
            >
              <label>
                每日任务加分
                <input
                  defaultValue={cloudPetCareScoreRules.dailyTaskBonus}
                  min="0"
                  max="50"
                  name="dailyTaskBonus"
                  type="number"
                />
              </label>
              <label>
                稳定状态分数
                <input
                  defaultValue={cloudPetCareScoreRules.steadyMinScore}
                  min="0"
                  max="100"
                  name="steadyMinScore"
                  type="number"
                />
              </label>
              <label>
                良好状态分数
                <input
                  defaultValue={cloudPetCareScoreRules.thrivingMinScore}
                  min="0"
                  max="100"
                  name="thrivingMinScore"
                  type="number"
                />
              </label>
              <label className="admin-checkbox-label">
                <input
                  defaultChecked={cloudPetCareScoreRules.thrivingRequiresCareToday}
                  name="thrivingRequiresCareToday"
                  type="checkbox"
                />
                状态良好必须完成今日照护
              </label>
              <button
                className="admin-button"
                disabled={!canManageCloudPets || isUpdatingCareScoreRules}
                type="submit"
              >
                {isUpdatingCareScoreRules ? "保存中..." : "保存照护分规则"}
              </button>
              {!canManageCloudPets ? (
                <span className="admin-muted">缺少 cloud_pets:write 权限</span>
              ) : null}
            </form>
          ) : null}
          <form
            className="admin-inline-form admin-cloud-pet-filters"
            data-testid="admin-cloud-pet-filter-form"
            onSubmit={(event) => void handleCloudPetFilters(event)}
          >
            <label>
              搜索
              <input
                data-testid="admin-cloud-pet-filter-q"
                onChange={(event) =>
                  setCloudPetFilters((current) => ({ ...current, q: event.target.value }))
                }
                placeholder="搜索宠物名、编号或会员手机号"
                value={cloudPetFilters.q}
              />
            </label>
            <label>
              宠物类型
              <select
                data-testid="admin-cloud-pet-filter-species"
                onChange={(event) =>
                  setCloudPetFilters((current) => ({ ...current, species: event.target.value }))
                }
                value={cloudPetFilters.species}
              >
                <option value="">全部</option>
                <option value="cat">猫</option>
                <option value="dog">狗</option>
              </select>
            </label>
            <label>
              照护状态
              <select
                data-testid="admin-cloud-pet-filter-care-state"
                onChange={(event) =>
                  setCloudPetFilters((current) => ({ ...current, careState: event.target.value }))
                }
                value={cloudPetFilters.careState}
              >
                <option value="">全部</option>
                <option value="needs_care">需要照护</option>
                <option value="steady">稳定</option>
                <option value="thriving">状态良好</option>
              </select>
            </label>
            <label>
              风险等级
              <select
                data-testid="admin-cloud-pet-filter-risk"
                onChange={(event) =>
                  updateLiveCloudPetFilter(
                    "riskLevel",
                    event.target.value as CloudPetStructuredFilters["riskLevel"]
                  )
                }
                value={cloudPetFilters.riskLevel}
              >
                <option value="">全部</option>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label>
              风险原因
              <select
                data-testid="admin-cloud-pet-filter-risk-reason"
                onChange={(event) =>
                  updateLiveCloudPetFilter(
                    "riskReason",
                    event.target.value as CloudPetRiskReasonCode | ""
                  )
                }
                value={cloudPetFilters.riskReason}
              >
                <option value="">全部风险原因</option>
                {cloudPetRiskReasonOptions.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}（{riskReasonCounts[reason.code]}）
                  </option>
                ))}
              </select>
            </label>
            <label>
              排序
              <select
                data-testid="admin-cloud-pet-sort-risk"
                onChange={(event) =>
                  updateLiveCloudPetFilter(
                    "sortBy",
                    event.target.value as CloudPetStructuredFilters["sortBy"]
                  )
                }
                value={cloudPetFilters.sortBy}
              >
                <option value="">默认排序</option>
                <option value="risk_desc">风险优先</option>
              </select>
            </label>

            <button
              className="admin-button admin-button--small"
              data-testid="admin-cloud-pet-filter-apply"
              type="submit"
            >
              应用筛选
            </button>
            <button
              className="admin-button admin-button--small admin-button--ghost"
              data-testid="admin-cloud-pet-filter-reset"
              onClick={() => void handleResetCloudPetFilters()}
              type="button"
            >
              重置
            </button>
          </form>
          {selectedCloudPetDetail ? (
            <div className="admin-inventory-alerts" data-testid="admin-cloud-pet-detail">
              <div className="admin-inline-actions">
                <strong>
                  {selectedCloudPetDetail.pet.name} / {selectedCloudPetDetail.pet.petNo}
                </strong>
                <div className="admin-inline-actions" data-testid="admin-cloud-pet-detail-navigation">
                  <button
                    className="admin-button admin-button--small admin-button--ghost"
                    data-testid="admin-cloud-pet-previous"
                    disabled={selectedCloudPetIndex <= 0}
                    onClick={() => handleNavigateCloudPet(-1)}
                    type="button"
                  >
                    上一只
                  </button>
                  <span data-testid="admin-cloud-pet-position">
                    {selectedCloudPetIndex >= 0
                      ? `第 ${selectedCloudPetIndex + 1} / ${displayedCloudPets.length} 只`
                      : "当前宠物不在筛选结果中"}
                  </span>
                  <button
                    className="admin-button admin-button--small admin-button--ghost"
                    data-testid="admin-cloud-pet-next"
                    disabled={
                      selectedCloudPetIndex < 0 ||
                      selectedCloudPetIndex >= displayedCloudPets.length - 1
                    }
                    onClick={() => handleNavigateCloudPet(1)}
                    type="button"
                  >
                    下一只
                  </button>
                </div>
                <button
                  className="admin-button admin-button--small admin-button--ghost"
                  data-testid="admin-cloud-pet-detail-close"
                  onClick={handleClearCloudPetDetail}
                  type="button"
                >
                  收起详情
                </button>
              </div>
              <span>
                主人：{selectedCloudPetDetail.pet.ownerName} / {selectedCloudPetDetail.pet.ownerPhone}
              </span>
              <span>
                照护：{getStatusLabel(selectedCloudPetDetail.pet.growth.careState)} / 分数 {selectedCloudPetDetail.pet.growth.careScore} / 连续 {selectedCloudPetDetail.pet.growth.careStreakDays} 天
              </span>
              <span>
                日记记录：{selectedCloudPetDetail.diary.entryCount}
                {selectedCloudPetDetail.diary.latestEntry
                  ? ` / 最新：${selectedCloudPetDetail.diary.latestEntry.title}`
                  : ""}
              </span>
              {selectedCloudPetDetail.diary.latestOwnerNote?.id ? (
                <button
                  className="admin-button admin-button--ghost"
                  data-testid="admin-cloud-pet-remove-owner-note"
                  disabled={busyDiaryNoteId === selectedCloudPetDetail.diary.latestOwnerNote.id}
                  onClick={() =>
                    void handleRemoveCloudPetDiaryNote(
                      selectedCloudPetDetail.pet.petNo,
                      selectedCloudPetDetail.diary.latestOwnerNote!.id!
                    )
                  }
                  type="button"
                >
                  {busyDiaryNoteId === selectedCloudPetDetail.diary.latestOwnerNote.id
                    ? "移除中..."
                    : "从公开归档中移除主人手记"}
                </button>
              ) : null}
              <span data-testid="admin-cloud-pet-community-signals">
                社区：{selectedCloudPetDetail.community.postCount} 条帖子 / {selectedCloudPetDetail.community.likeCount} 个赞 / {selectedCloudPetDetail.community.commentCount} 条评论 / {selectedCloudPetDetail.community.reportCount} 条举报 / {selectedCloudPetDetail.community.pendingReportCount} 条待处理
              </span>
              <span>
                主页访问：{selectedCloudPetDetail.archive.engagement.homepageVisitCount}
              </span>
              <div className="admin-cloud-pet-risk-list" data-testid="admin-cloud-pet-risk-signals">
                <strong>运营风险信号</strong>
                {getCloudPetOperationalSignals(selectedCloudPetDetail).map((signal) => (
                  <article className={"admin-cloud-pet-risk admin-cloud-pet-risk--" + signal.level} key={signal.key}>
                    <span>{getRiskLevelLabel(signal.level)}</span>
                    <strong>{signal.title}</strong>
                    <p>{signal.description}</p>
                    {signal.actionHref ? (
                      <Link className="admin-button admin-button--small admin-button--ghost" href={signal.actionHref}>
                        {signal.actionLabel}
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
              <div className="admin-cloud-pet-snippets" data-testid="admin-cloud-pet-recent-diaries">
                <strong>近期日记</strong>
                {selectedCloudPetDetail.archive.items
                  .filter((item) => item.type === "daily_diary" || item.type === "owner_note")
                  .slice(0, 3)
                  .map((item) => (
                    <article key={item.type + "-" + item.createdAt}>
                      <span>{item.type === "owner_note" ? "主人手记" : "生成日记"}</span>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </article>
                  ))}
                {selectedCloudPetDetail.archive.items.filter((item) => item.type === "daily_diary" || item.type === "owner_note").length === 0 ? (
                  <p className="admin-muted">暂无近期日记。</p>
                ) : null}
              </div>
              <div className="admin-cloud-pet-snippets" data-testid="admin-cloud-pet-recent-community-posts">
                <strong>近期社区动态</strong>
                {selectedCloudPetDetail.community.posts.slice(0, 3).map((post) => (
                  <article key={post.postNo}>
                    <span>{post.authorName} / {post.likeCount} 个赞 / {post.commentCount} 条评论</span>
                    <strong>{post.postNo}</strong>
                    <p>{post.body}</p>
                  </article>
                ))}
                {selectedCloudPetDetail.community.posts.length === 0 ? (
                  <p className="admin-muted">暂无社区动态。</p>
                ) : null}
              </div>
              <Link
                className="admin-button admin-button--small admin-button--ghost"
                data-testid="admin-cloud-pet-public-homepage"
                href={`/cloud-pets/${selectedCloudPetDetail.pet.petNo}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                打开宠物主页
              </Link>
            </div>
          ) : null}
          <div className="admin-list">
            {displayedCloudPets.map((pet) => (
              <div
                className="admin-pet"
                data-pet-no={pet.petNo}
                data-testid="admin-cloud-pet-list-item"
                key={pet.petNo}
              >
                <div>
                  <strong>{pet.name}</strong>
                  <span>{pet.petNo + " / " + pet.species}</span>
                </div>
                <em>
                  {pet.communityPostCount} 条帖子{" / "}{pet.homepageVisitCount ?? 0} 次访问
                </em>
                <div className="admin-cloud-pet-list-risk" data-testid="admin-cloud-pet-list-risk">
                  <span className={"admin-cloud-pet-list-risk__badge admin-cloud-pet-list-risk__badge--" + evaluateCloudPetRisk(pet).highestLevel}>
                    {getRiskLevelLabel(evaluateCloudPetRisk(pet).highestLevel)}
                  </span>
                  <span>{evaluateCloudPetRisk(pet).count} 个风险信号</span>
                  <small>{evaluateCloudPetRisk(pet).summary}</small>
                </div>
                <button
                  className="admin-button admin-button--small admin-button--ghost"
                  data-testid="admin-cloud-pet-detail-open"
                  disabled={busyCloudPetNo === pet.petNo}
                  onClick={() => void handleLoadCloudPetDetail(pet.petNo)}
                  type="button"
                >
                  {busyCloudPetNo === pet.petNo ? "加载中..." : "查看运营详情"}
                </button>
              </div>
            ))}
            {displayedCloudPets.length === 0 ? <p className="admin-muted">没有符合当前筛选条件的云养宠。</p> : null}
          </div>
        </article>

        <article className="admin-card" id="admin-community-posts">
          <p className="section__kicker">社区审核</p>
          <h2>社区帖子</h2>
          <div className="admin-list">
            {posts.map((post) => (
              <div className="admin-post" key={post.postNo}>
                <div>
                  <strong>{post.petName}</strong>
                  <span>{post.postNo + " / " + post.status}</span>
                </div>
                <p>{post.body}</p>
                <button
                  className="admin-button admin-button--small"
                  disabled={busyPostNo === post.postNo}
                  onClick={() =>
                    void handleModeration(
                      post.postNo,
                      post.status === "hidden" ? "visible" : "hidden"
                    )
                  }
                  type="button"
                >
                  {post.status === "hidden" ? "恢复" : "隐藏"}
                </button>
              </div>
            ))}
            {posts.length === 0 ? <p className="admin-muted">暂无社区帖子。</p> : null}
          </div>
        </article>

        <article className="admin-card" id="admin-community-reports">
          <p className="section__kicker">社区举报</p>
          <h2>举报队列</h2>
          <form
            className="admin-inline-form admin-cloud-pet-filters"
            data-testid="admin-community-report-filter-form"
            onSubmit={(event) => void handleCommunityReportFilters(event)}
          >
            <label>
              状态
              <select
                data-testid="admin-community-report-filter-status"
                onChange={(event) =>
                  setReportFilters((current) => ({ ...current, status: event.target.value }))
                }
                value={reportFilters.status}
              >
                <option value="">全部</option>
                <option value="pending_review">待审核</option>
                <option value="reviewed">已处理</option>
                <option value="dismissed">已驳回</option>
              </select>
            </label>
            <label>
              帖子编号
              <input
                data-testid="admin-community-report-filter-post"
                onChange={(event) =>
                  setReportFilters((current) => ({ ...current, postNo: event.target.value }))
                }
                placeholder="POST001"
                value={reportFilters.postNo}
              />
            </label>
            <label>
              会员手机号
              <input
                data-testid="admin-community-report-filter-member"
                onChange={(event) =>
                  setReportFilters((current) => ({ ...current, memberPhone: event.target.value }))
                }
                placeholder="13800000000"
                value={reportFilters.memberPhone}
              />
            </label>
            <button className="admin-button admin-button--small" type="submit">
              应用筛选
            </button>
            <button
              className="admin-button admin-button--small admin-button--ghost"
              onClick={() => void handleResetCommunityReportFilters()}
              type="button"
            >
              重置
            </button>
          </form>
          <div className="admin-list">
            {reports.map((report) => (
              <div
                className="admin-post"
                data-report-no={report.reportNo}
                data-testid="admin-community-report-item"
                key={report.reportNo}
              >
                <div>
                  <strong>{report.reportNo}</strong>
                  <span data-testid="admin-community-report-status">
                    {getStatusLabel(report.status) + " / " + report.postNo}
                  </span>
                  <span>
                    举报人 {report.reporterName} / {report.memberPhone ?? "未提供手机号"} / {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                <p>{report.reason}</p>
                {report.note ? <p className="admin-muted">处理备注：{report.note}</p> : null}
                {report.resolvedAt ? (
                  <small>处理时间：{new Date(report.resolvedAt).toLocaleString()}</small>
                ) : null}
                {report.status === "pending_review" ? (
                  <div className="admin-inline-actions">
                    <button
                      className="admin-button admin-button--small"
                      data-testid="admin-community-report-resolve-hide"
                      disabled={busyReportNo === report.reportNo}
                      onClick={() =>
                        void handleReportStatus(report.reportNo, "reviewed", {
                          hidePostNo: report.postNo
                        })
                      }
                      type="button"
                    >
                      处理并隐藏帖子
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      data-testid="admin-community-report-resolve"
                      disabled={busyReportNo === report.reportNo}
                      onClick={() => void handleReportStatus(report.reportNo, "reviewed")}
                      type="button"
                    >
                      仅标记已处理
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      data-testid="admin-community-report-dismiss"
                      disabled={busyReportNo === report.reportNo}
                      onClick={() => void handleReportStatus(report.reportNo, "dismissed")}
                      type="button"
                    >
                      驳回举报
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {reports.length === 0 ? <p className="admin-muted">暂无社区举报。</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}

function getSlaRiskLevel(status: "on_track" | "due_soon" | "overdue") {
  if (status === "overdue") {
    return "high";
  }

  if (status === "due_soon") {
    return "medium";
  }

  return "low";
}



type CloudPetOperationalSignal = {
  key: string;
  level: "high" | "medium" | "low";
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
};

function getCloudPetOperationalSignals(
  detail: AdminCloudPetOperationalDetail
): CloudPetOperationalSignal[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const hasTodayDiary = detail.archive.items.some(
    (item) => item.type === "daily_diary" && item.createdAt.startsWith(todayKey)
  );
  const baseSignals = new Map(
    evaluateCloudPetRisk(detail.pet).reasons.map((reason) => [
      reason.code,
      getCloudPetBaseRiskSignal(detail, reason.code, reason.level, reason.label)
    ])
  );
  const signals: Array<CloudPetOperationalSignal | undefined> = [];

  signals.push(baseSignals.get("care_incomplete_today"));

  if (!hasTodayDiary) {
    signals.push({
      key: "diary-missing",
      level: "high",
      title: "今日日记缺失",
      description: "今日尚未生成云养宠日记，可进入缺口页执行补救。",
      actionHref: "/admin/pets/daily-diary-coverage",
      actionLabel: "查看日记缺口"
    });
  }

  if (detail.community.pendingReportCount > 0) {
    const pendingReportPostNos = detail.community.pendingReportPostNos ?? [];
    const actionHref = pendingReportPostNos.length === 1
      ? `/admin?reportStatus=pending_review&reportPostNo=${encodeURIComponent(pendingReportPostNos[0])}#admin-community-reports`
      : "#admin-community-reports";
    signals.push({
      key: "pending-report",
      level: "high",
      title: "社区举报待处理",
      description: "该宠物关联的社区内容存在待处理举报。",
      actionHref,
      actionLabel: "处理举报"
    });
  }

  signals.push(baseSignals.get("needs_care_state"));
  signals.push(baseSignals.get("no_homepage_visits"));
  signals.push(baseSignals.get("no_community_posts"));

  const resolvedSignals = signals.filter(
    (signal): signal is CloudPetOperationalSignal => Boolean(signal)
  );

  return resolvedSignals.length > 0
    ? resolvedSignals
    : [
        {
          key: "healthy",
          level: "low",
          title: "当前运营状态正常",
          description: "暂未发现需要立即处理的运营风险信号。"
        }
      ];
}

function getCloudPetBaseRiskSignal(
  detail: AdminCloudPetOperationalDetail,
  code: CloudPetRiskReasonCode,
  level: "high" | "medium" | "low",
  label: string
): CloudPetOperationalSignal {
  const common = { level, title: label } as const;

  switch (code) {
    case "care_incomplete_today":
      return {
        ...common,
        key: "care-incomplete",
        description: "今日成长任务尚未形成完整照护记录，需要及时跟进。",
        actionHref: "#admin-cloud-pets",
        actionLabel: "查看成长任务"
      };
    case "needs_care_state":
      return {
        ...common,
        key: "needs-care-state",
        description: "当前照护分处于需要照护区间，建议检查任务完成情况。",
        actionHref: "#admin-cloud-pets",
        actionLabel: "查看照护配置"
      };
    case "no_homepage_visits":
      return {
        ...common,
        key: "no-homepage-visits",
        description: "公开主页尚无访问记录，可检查分享入口和主页内容。",
        actionHref: "/cloud-pets/" + detail.pet.petNo,
        actionLabel: "打开主页"
      };
    case "no_community_posts":
      return {
        ...common,
        key: "no-community-posts",
        description: "该宠物还没有社区动态，可安排内容运营跟进。",
        actionHref: "#admin-community-posts",
        actionLabel: "查看社区"
      };
  }
}


function getSqliteRecoveryStatusLabel(
  status: AdminSqliteRecoveryStatus["status"]
) {
  return {
    no_backup: "尚未发现备份",
    backup_unverified: "最新备份尚未完成恢复验证",
    recoverable: "最新备份已通过恢复演练",
    drill_failed: "最近恢复演练失败，需要关注",
    unavailable: "未配置恢复状态目录"
  }[status];
}

function getCloudPetLaunchReadinessAttentionLabel(
  code: AdminCloudPetLaunchReadiness["attentionItems"][number]["code"]
) {
  return {
    API_NOT_READY: "API 或数据库尚未达到生产就绪状态",
    CONFIG_BASELINE_UNCONFIGURED: "生产安全配置基线尚未配置",
    CONFIG_BASELINE_MISMATCH: "生产安全配置基线与发布预期不一致",
    RELEASE_ID_UNCONFIGURED: "生产发布缺少 release ID，无法可靠确认当前运行版本",
    DATABASE_MIGRATION_NOT_READY: "数据库迁移状态暂未确认与当前发布兼容",
    RUNTIME_CRITICAL: "云养宠运行状态存在关键异常",
    RECOVERY_NOT_VERIFIED: "数据备份尚未完成恢复验证",
    BACKUP_STALE: "数据备份已经过期，需要更新",
    AUTO_RECOVERY_SUPPRESSED: "自动数据保护当前处于失败抑制"
  }[code];
}

function getCloudPetConfigBaselineLabel(
  status: AdminDeploymentReadiness["configBaseline"]["status"]
) {
  return {
    matched: "一致",
    unconfigured: "尚未配置",
    mismatch: "与发布预期不一致"
  }[status];
}

function getCloudPetReleaseLabel(
  release: AdminDeploymentReadiness["release"]
) {
  return release.status === "identified" && release.id
    ? release.id
    : "未标识";
}

function getCloudPetMigrationCompatibilityLabel(
  status: AdminDeploymentReadiness["migrationCompatibility"]["status"]
) {
  return {
    compatible: "与当前发布兼容",
    mismatch: "需要处理",
    unavailable: "暂时无法确认"
  }[status];
}

function getCloudPetWebApiReleaseLabel(
  status: ReturnType<typeof compareCloudPetWebApiRelease>
) {
  return {
    matched: "一致",
    mismatch: "不一致",
    unidentified: "未标识"
  }[status];
}

function getCloudPetWebReleaseAttentionLabel(
  code: "WEB_RELEASE_UNIDENTIFIED" | "WEB_API_RELEASE_MISMATCH"
) {
  return {
    WEB_RELEASE_UNIDENTIFIED: "Web 发布未标识，无法确认前后端是否属于同一发布",
    WEB_API_RELEASE_MISMATCH: "Web 与 API 发布不一致，需要处理"
  }[code];
}

function getCloudPetLaunchReadinessAttentionTarget(
  code: AdminCloudPetLaunchReadiness["attentionItems"][number]["code"]
) {
  const targets: Record<
    AdminCloudPetLaunchReadiness["attentionItems"][number]["code"],
    { href: string; label: string }
  > = {
    API_NOT_READY: {
      href: "#admin-deployment-readiness",
      label: "查看部署状态"
    },
    CONFIG_BASELINE_UNCONFIGURED: {
      href: "#admin-deployment-readiness",
      label: "查看部署状态"
    },
    CONFIG_BASELINE_MISMATCH: {
      href: "#admin-deployment-readiness",
      label: "查看部署状态"
    },
    RELEASE_ID_UNCONFIGURED: {
      href: "#admin-deployment-readiness",
      label: "查看部署状态"
    },
    DATABASE_MIGRATION_NOT_READY: {
      href: "#admin-deployment-readiness",
      label: "查看部署状态"
    },
    RUNTIME_CRITICAL: {
      href: "#admin-cloud-pet-health",
      label: "查看运行状态"
    },
    RECOVERY_NOT_VERIFIED: {
      href: "#admin-data-protection",
      label: "查看数据保护"
    },
    BACKUP_STALE: {
      href: "#admin-data-protection",
      label: "查看数据保护"
    },
    AUTO_RECOVERY_SUPPRESSED: {
      href: "#admin-data-protection",
      label: "查看数据保护"
    }
  };

  return targets[code];
}

function getSqliteRecoveryAutoRefreshOutcomeLabel(
  outcome: AdminSqliteRecoveryStatus["autoRefreshRuntime"]["lastOutcome"]
) {
  switch (outcome) {
    case "run_succeeded":
      return "已创建并验证新备份";
    case "skipped_fresh":
      return "当前备份仍新鲜，无需执行";
    case "skipped_ineligible":
      return "当前状态不满足自动保鲜条件";
    case "skipped_busy":
      return "已有数据保护任务正在执行，本次自动检查已跳过";
    case "skipped_suppressed":
      return "自动执行已暂停";
    case "run_failed":
      return "最近自动执行失败";
    default:
      return "尚未执行";
  }
}

function formatSqliteRecoveryAutoRefreshTimestamp(value: string | null) {
  return value ? new Date(value).toLocaleString() : "尚未执行";
}

function getSqliteRecoveryFreshnessLabel(
  freshness: AdminSqliteRecoveryStatus["freshness"]
) {
  return {
    fresh: "正常",
    stale: "需要更新",
    unknown: "未知"
  }[freshness];
}

function formatAgeSeconds(ageSeconds: number) {
  if (ageSeconds < 60) return `${ageSeconds} 秒前`;
  const minutes = Math.floor(ageSeconds / 60);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}
