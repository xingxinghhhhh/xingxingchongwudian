"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { CommunityPost } from "../cloud-pets/cloud-pets-api";
import { formatCents, OrderResponse, ShopProductDetail } from "../shop/shop-api";
import {
  AdminCloudPet,
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
  getCurrentAdminStaff,
  getAdminDashboard,
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
  updateCommunityPostStatus,
  updateCommunityReportStatus,
  updateCmsBlockStatus,
  updateCouponStatus,
  updateCustomerCrm,
  updateProductStatus,
  updateRefundStatus,
  updateReviewStatus,
  updateVariantStock
} from "./admin-api";

const defaultToken = "";

export function AdminConsole() {
  const [token, setToken] = useState(defaultToken);
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
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
  const [status, setStatus] = useState("Load merchant operations data.");
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
  const [isGeneratingDailyDiaries, setIsGeneratingDailyDiaries] = useState(false);
  const [dailyDiaryGeneration, setDailyDiaryGeneration] =
    useState<CloudPetDailyDiaryGenerationResult | null>(null);
  const [dailyDiaryStatus, setDailyDiaryStatus] =
    useState<CloudPetDailyDiaryStatusResult | null>(null);
  const canManageCustomers =
    currentStaff?.permissions.includes("customers:write") ?? false;

  useEffect(() => {
    const storedToken = localStorage.getItem("kzt_admin_session") ?? defaultToken;
    setToken(storedToken);
    if (storedToken) {
      void loadAdminData(storedToken);
    }
  }, []);

  async function loadAdminData(nextToken = token) {
    if (!nextToken) {
      setError("Admin session required");
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
        nextOperationLogs
      ] = await Promise.all([
        getAdminDashboard(nextToken),
        getMerchantAnalytics(nextToken),
        listAdminCustomers(nextToken),
        listAdminCmsBlocks(nextToken),
        listAdminCloudPets(nextToken),
        listAdminCommunityPosts(nextToken),
        listAdminCommunityReports(nextToken),
        listAdminProducts(nextToken),
        listAdminOrders(nextToken),
        listAdminCoupons(nextToken),
        listAdminRefunds(nextToken),
        listAdminReviews(nextToken),
        listLowStockVariants(nextToken),
        getCloudPetDailyDiaryStatus(nextToken),
        nextStaff.permissions.includes("audit:read")
          ? listOperationLogs(nextToken)
          : Promise.resolve([])
      ]);

      setCurrentStaff(nextStaff);
      setMetrics(nextMetrics);
      setAnalytics(nextAnalytics);
      setCustomers(nextCustomers);
      setCmsBlocks(nextCmsBlocks);
      setPets(nextPets);
      setPosts(nextPosts);
      setReports(nextReports);
      setProducts(nextProducts);
      setOrders(nextOrders);
      setCoupons(nextCoupons);
      setRefunds(nextRefunds);
      setReviews(nextReviews);
      setLowStock(nextLowStock);
      setDailyDiaryStatus(nextDailyDiaryStatus);
      setOperationLogs(nextOperationLogs);
      setStatus("Merchant operations data refreshed.");
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

      setError(caught instanceof Error ? caught.message : "Failed to load admin data");
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await adminLogout(token);
      } catch {
        // Best-effort logout: clear the local session even if the request fails.
      }
    }

    localStorage.removeItem("kzt_admin_session");
    window.location.href = "/admin/login";
  }

  async function handleStockUpdate(skuCode: string, stockText: string) {
    const stock = Number(stockText);

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be 0 or a positive integer");
      return;
    }

    setBusyProductKey(skuCode);
    setError(null);

    try {
      await updateVariantStock(skuCode, stock, token);
      await loadAdminData(token);
      setStatus(`${skuCode} stock updated to ${stock}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Stock update failed");
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
      setStatus(`Product ${statusValue === "active" ? "published" : "archived"}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product status update failed");
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
      setError("Product price must be greater than 0");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be 0 or a positive integer");
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
      setStatus("Product created and published.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Product creation failed");
    } finally {
      setIsCreatingProduct(false);
    }
  }

  async function handleCreateCmsBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const sortOrder = Number(formData.get("sortOrder") ?? 100);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError("CMS sort order must be 0 or a positive integer");
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
      setStatus("CMS block created.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CMS block creation failed");
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
      setStatus(`${blockNo} CMS block ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CMS status update failed");
    } finally {
      setBusyCmsBlockNo(null);
    }
  }

  async function handleMarkCustomerVip(customer: AdminCustomerListItem) {
    if (!canManageCustomers) {
      setError("Permission denied: customers:write");
      return;
    }

    setBusyCustomerPhone(customer.phone);
    setError(null);

    try {
      await updateCustomerCrm(
        customer.phone,
        {
          tags: Array.from(new Set([...customer.tags, "vip_candidate"])),
          note: "Marked from merchant CRM console for bundle follow-up.",
          ownerStaffName: currentStaff?.name
        },
        token
      );
      await loadAdminData(token);
      setStatus(`${customer.phone} marked as VIP candidate.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer CRM update failed");
    } finally {
      setBusyCustomerPhone(null);
    }
  }

  async function handleCustomerFollowUp(customer: AdminCustomerListItem) {
    if (!canManageCustomers) {
      setError("Permission denied: customers:write");
      return;
    }

    setBusyCustomerPhone(customer.phone);
    setError(null);

    try {
      await createCustomerFollowUp(
        customer.phone,
        {
          type: "wechat",
          summary: `Followed up with ${customer.nextBestAction.ctaLabel}.`
        },
        token
      );
      await loadAdminData(token);
      setStatus(`${customer.phone} follow-up recorded.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Customer follow-up failed");
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
      setStatus(`${code} is now ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Coupon update failed");
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
        statusValue === "approved" ? "Approved in merchant console" : "Rejected in merchant console",
        token
      );
      await loadAdminData(token);
      setStatus(`${refundNo} ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refund update failed");
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
      setStatus(`${reviewNo} review ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review update failed");
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
      setStatus(`${orderNo} shipment recorded.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fulfillment failed");
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
        location: "Transit hub",
        description: "Shipment is moving to the next station."
      },
      out_for_delivery: {
        location: "Local delivery station",
        description: "Courier is out for delivery."
      },
      delivered: {
        location: "Customer address",
        description: "Package signed by customer."
      },
      exception: {
        location: "Carrier service desk",
        description: "Delivery exception needs merchant follow-up."
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
      setStatus(`${orderNo} tracking updated to ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Shipment event failed");
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
      setStatus(`Community post ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Moderation failed");
    } finally {
      setBusyPostNo(null);
    }
  }

  async function handleReportStatus(
    reportNo: string,
    statusValue: "reviewed" | "dismissed"
  ) {
    setBusyReportNo(reportNo);
    setError(null);

    try {
      await updateCommunityReportStatus(
        reportNo,
        statusValue,
        statusValue === "reviewed" ? "Handled by merchant console" : "Dismissed by merchant console",
        token
      );
      await loadAdminData(token);
      setStatus(`Community report ${statusValue}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Report update failed");
    } finally {
      setBusyReportNo(null);
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
        `Daily diaries generated: ${result.generatedCount}; skipped: ${result.skippedCount}.`
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Daily diary generation failed"
      );
    } finally {
      setIsGeneratingDailyDiaries(false);
    }
  }

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">Merchant Console</p>
          <h2>Operations Control Center</h2>
          <p>Manage catalog, marketing, fulfillment, after-sales, cloud pets, and community content.</p>
        </div>
        <div className="admin-token-form">
          <button
            className="admin-button"
            onClick={() => void loadAdminData(token)}
            type="button"
          >
            Refresh data
          </button>
          <Link className="admin-button admin-button--ghost" href="/admin/payments">
            Payments
          </Link>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            Sign out
          </button>
        </div>
        <p className={error ? "admin-status admin-status--error" : "admin-status"}>
          {error ?? status}
        </p>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Staff Access</p>
        <h2>Current Operator And Permissions</h2>
        <div className="admin-row">
          <div>
            <strong>{currentStaff?.name ?? "Not loaded"}</strong>
            <span>
              {currentStaff?.staffNo ?? "STAFF_UNKNOWN"} /{" "}
              {currentStaff?.role ?? "unknown"}
            </span>
          </div>
          <em>{currentStaff?.permissions.length ?? 0} permissions</em>
        </div>
        <div className="admin-inventory-alerts">
          {(currentStaff?.permissions ?? []).map((permission) => (
            <span key={permission}>{permission}</span>
          ))}
          {!currentStaff ? <span>Load data to inspect staff permissions.</span> : null}
        </div>
      </section>

      <section className="admin-metrics">
        {[
          ["Active products", metrics?.activeProductCount ?? 0],
          ["Cloud pets", metrics?.cloudPetCount ?? 0],
          ["Diary covered", metrics?.dailyDiaryCoveredCount ?? 0],
          ["Diary missing", metrics?.dailyDiaryMissingCount ?? 0],
          [
            "Diary coverage",
            `${Math.round((metrics?.dailyDiaryCoverageRate ?? 0) * 100)}%`
          ],
          ["Community posts", metrics?.communityPostCount ?? 0],
          ["Low-stock SKUs", metrics?.lowStockVariantCount ?? 0],
          ["Orders", metrics?.orderCount ?? 0],
          ["Pending orders", metrics?.pendingOrderCount ?? 0],
          ["Payment intents", metrics?.paymentIntentCount ?? 0],
          ["Pending payments", metrics?.pendingPaymentIntentCount ?? 0],
          ["Failed payments", metrics?.failedPaymentIntentCount ?? 0],
          ["Overdue payments", metrics?.overduePaymentIntentCount ?? 0],
          ["Pending refunds", metrics?.pendingRefundCount ?? 0],
          ["Expedited refunds", metrics?.expeditedRefundCount ?? 0],
          ["Blocked refunds", metrics?.blockedRefundCount ?? 0],
          ["Due soon refunds", metrics?.dueSoonRefundCount ?? 0],
          ["Overdue refunds", metrics?.overdueRefundCount ?? 0],
          ["Refund liability", formatCents(metrics?.pendingRefundAmountCents ?? 0)],
          ["Audit logs", metrics?.operationLogCount ?? 0],
          ["High-risk ops", metrics?.highRiskOperationCount ?? 0],
          ["Permission denied", metrics?.permissionDeniedCount ?? 0],
          ["Hidden posts", metrics?.hiddenCommunityPostCount ?? 0]
        ].map(([label, value]) => (
          <article className="admin-metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>

      <section className="admin-card">
        <p className="section__kicker">Payments</p>
        <h2>Payment Risk Queue</h2>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=failed">
            Failed payments ({metrics?.failedPaymentIntentCount ?? 0})
          </Link>
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=pending&overdue=true">
            Overdue payments ({metrics?.overduePaymentIntentCount ?? 0})
          </Link>
          <Link className="admin-button admin-button--ghost" href="/admin/payments?status=pending">
            Pending payments ({metrics?.pendingPaymentIntentCount ?? 0})
          </Link>
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Merchant Analytics</p>
        <h2>Revenue, Repeat Purchase, And Retention</h2>
        <div className="admin-metrics">
          {[
            ["GMV", formatCents(analytics?.revenue.gmvCents ?? 0)],
            ["Paid orders", analytics?.revenue.paidOrderCount ?? 0],
            ["Average order", formatCents(analytics?.revenue.averageOrderValueCents ?? 0)],
            ["Paid order rate", `${analytics?.conversion.paidOrderRate ?? 0}%`],
            ["Repeat customers", analytics?.customers.repeatCustomerCount ?? 0],
            ["Repeat rate", `${analytics?.customers.repeatPurchaseRate ?? 0}%`]
          ].map(([label, value]) => (
            <article className="admin-metric" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className="admin-list">
          <strong>Top selling SKUs</strong>
          {(analytics?.productRankings ?? []).map((item) => (
            <div className="admin-row" key={item.skuCode}>
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.skuCode} / sold {item.quantitySold} / revenue{" "}
                  {formatCents(item.revenueCents)}
                </span>
              </div>
            </div>
          ))}
          {analytics?.productRankings.length === 0 ? (
            <p className="admin-muted">No paid order product rankings yet.</p>
          ) : null}
        </div>
        <div className="admin-list">
          <strong>Conversion funnel</strong>
          {(analytics?.retentionFunnel ?? []).map((stage) => (
            <div className="admin-row" key={stage.key}>
              <div>
                <strong>
                  {stage.title} / {stage.count} members
                </strong>
                <span>
                  Conversion: {stage.conversionRate}% / Drop-off:{" "}
                  {stage.dropOffCount}
                </span>
                <span>Action: {stage.actionLabel}</span>
              </div>
            </div>
          ))}
          {(analytics?.retentionFunnel ?? []).length === 0 ? (
            <p className="admin-muted">No conversion funnel data available yet.</p>
          ) : null}
        </div>
        <div className="admin-inventory-alerts">
          <strong>Retention signals</strong>
          <span>Cloud pets: {analytics?.retentionSignals.cloudPetCount ?? 0}</span>
          <span>Homepage visits: {analytics?.retentionSignals.homepageVisitCount ?? 0}</span>
          <span>Community posts: {analytics?.retentionSignals.communityPostCount ?? 0}</span>
          <span>Reviews: {analytics?.retentionSignals.reviewCount ?? 0}</span>
          <span>Pending reviews: {analytics?.retentionSignals.pendingReviewCount ?? 0}</span>
          <span>
            Pending reports:{" "}
            {analytics?.retentionSignals.pendingCommunityReportCount ?? 0}
          </span>
        </div>
        <div className="admin-list">
          <strong>Customer segments</strong>
          {(analytics?.customerSegments ?? []).map((segment) => (
            <div className="admin-row" key={segment.key}>
              <div>
                <strong>
                  {segment.title} / {segment.memberCount} members
                </strong>
                <span>{segment.description}</span>
                <span>
                  Action: {segment.actionLabel} / Priority: {segment.priority}
                </span>
                <span>
                  Sample phones:{" "}
                  {segment.samplePhones.length > 0
                    ? segment.samplePhones.join(", ")
                    : "No matching members yet"}
                </span>
              </div>
            </div>
          ))}
          {(analytics?.customerSegments ?? []).length === 0 ? (
            <p className="admin-muted">No customer segments available yet.</p>
          ) : null}
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Customer CRM</p>
        <h2>Customer Profiles And Follow-Up Actions</h2>
        {currentStaff && !canManageCustomers ? (
          <p className="admin-permission-note">
            Current staff role is read-only for CRM actions. customers:write is
            required to tag customers or log follow-ups.
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
                  Paid orders: {customer.paidOrderCount} / Revenue:{" "}
                  {formatCents(customer.totalPaidCents)} / Pets: {customer.petCount} /
                  Posts: {customer.communityPostCount}
                </span>
                <span>
                  Tags:{" "}
                  {customer.tags.length > 0
                    ? customer.tags.join(", ")
                    : "No tags yet"}
                </span>
                <span>
                  Next action: {customer.nextBestAction.title} /{" "}
                  {customer.nextBestAction.ctaLabel}
                </span>
              </div>
              <div className="admin-actions">
                <button
                  disabled={!canManageCustomers || busyCustomerPhone === customer.phone}
                  onClick={() => void handleMarkCustomerVip(customer)}
                  title={
                    canManageCustomers
                      ? undefined
                      : "Missing customers:write permission"
                  }
                  type="button"
                >
                  Mark VIP
                </button>
                <button
                  disabled={!canManageCustomers || busyCustomerPhone === customer.phone}
                  onClick={() => void handleCustomerFollowUp(customer)}
                  title={
                    canManageCustomers
                      ? undefined
                      : "Missing customers:write permission"
                  }
                  type="button"
                >
                  Log follow-up
                </button>
              </div>
            </div>
          ))}
          {customers.length === 0 ? (
            <p className="admin-muted">No customer CRM profiles yet.</p>
          ) : null}
        </div>
      </section>

      <section className="admin-grid">
        <article className="admin-card">
          <p className="section__kicker">Audit Trail</p>
          <h2>Recent Operation Logs</h2>
          <div className="admin-list">
            {operationLogs.map((log) => (
              <div className="admin-row" key={log.logNo}>
                <div>
                  <strong>{log.action}</strong>
                  <span>
                    {log.staffName} / {log.targetType}:{log.targetId}
                  </span>
                </div>
                <em>{new Date(log.createdAt).toLocaleString()}</em>
              </div>
            ))}
            {operationLogs.length === 0 ? (
              <p className="admin-muted">
                No readable operation logs for this staff role yet.
              </p>
            ) : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">CMS Automation</p>
          <h2>Homepage And Campaign Blocks</h2>
          <form className="admin-create-product" onSubmit={(event) => void handleCreateCmsBlock(event)}>
            <label>
              Slot key
              <input defaultValue="homepage.campaign" name="slotKey" required />
            </label>
            <label>
              Status
              <select defaultValue="published" name="status">
                <option value="draft">draft</option>
                <option value="published">published</option>
                <option value="archived">archived</option>
              </select>
            </label>
            <label>
              Sort order
              <input defaultValue="1" min={0} name="sortOrder" type="number" />
            </label>
            <label className="admin-create-product__wide">
              Title
              <input defaultValue="Daily cloud-pet growth campaign" name="title" required />
            </label>
            <label className="admin-create-product__wide">
              Body
              <textarea
                defaultValue="Publish today's diary, pet growth task, and shop recommendation into one homepage block."
                name="body"
                required
                rows={3}
              />
            </label>
            <label>
              CTA label
              <input defaultValue="Visit shop" name="ctaLabel" />
            </label>
            <label>
              Link
              <input defaultValue="/shop" name="href" />
            </label>
            <label className="admin-create-product__wide">
              Image URL
              <input defaultValue="/brand/naigai-niangao/naigai-standard.png" name="imageUrl" />
            </label>
            <button className="admin-button admin-create-product__wide" disabled={isCreatingCmsBlock} type="submit">
              {isCreatingCmsBlock ? "Publishing..." : "Create CMS block"}
            </button>
          </form>
          <div className="admin-list">
            {cmsBlocks.map((block) => (
              <div className="admin-row" key={block.blockNo}>
                <div>
                  <strong>{block.title}</strong>
                  <span>
                    {block.slotKey} / {block.status} / order {block.sortOrder}
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
                  {block.status === "published" ? "Archive" : "Publish"}
                </button>
              </div>
            ))}
            {cmsBlocks.length === 0 ? <p className="admin-muted">No CMS blocks yet.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Marketing Center</p>
          <h2>Coupon Campaigns</h2>
          <div className="admin-list">
            {coupons.map((coupon) => (
              <div className="admin-row" key={coupon.code}>
                <div>
                  <strong>{coupon.code}</strong>
                  <span>
                    {coupon.status} 璺?off {formatCents(coupon.discountValueCents)} 璺?min{" "}
                    {formatCents(coupon.minSpendCents)} 璺?used {coupon.usageCount}
                    {coupon.usageLimitPerMember
                      ? ` 璺?${coupon.usageLimitPerMember}/member`
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
                  {coupon.status === "active" ? "Pause coupon" : "Activate coupon"}
                </button>
              </div>
            ))}
            {coupons.length === 0 ? <p className="admin-muted">No coupons yet.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">After-sales</p>
          <h2>Refund Requests</h2>
          <div className="admin-list">
            {refunds.map((refund) => (
              <div className="admin-order" key={refund.refundNo}>
                <div>
                  <strong>{refund.refundNo}</strong>
                  <span>
                    {refund.status} 璺?{refund.orderNo} 璺?{formatCents(refund.requestedAmountCents)}
                  </span>
                </div>
                <div className="admin-refund-context">
                  <span>
                    Refundable{" "}
                    {formatCents(refund.refundableBalanceCents ?? refund.requestedAmountCents)}
                  </span>
                  <span>
                    After request{" "}
                    {formatCents(refund.remainingAfterRequestCents ?? 0)}
                  </span>
                  {refund.reviewRisk ? (
                    <strong className={`admin-risk admin-risk--${refund.reviewRisk.level}`}>
                      Risk {refund.reviewRisk.level} / {refund.reviewRisk.priority}:{" "}
                      {refund.reviewRisk.reason}
                    </strong>
                  ) : null}
                  {refund.reviewSla ? (
                    <strong className={`admin-risk admin-risk--${getSlaRiskLevel(refund.reviewSla.status)}`}>
                      SLA {refund.reviewSla.status}: {refund.reviewSla.hoursUntilDue}h left / due{" "}
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
                      Approve refund
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyRefundNo === refund.refundNo}
                      onClick={() => void handleRefundStatus(refund.refundNo, "rejected")}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <em>{refund.note ?? "Resolved"}</em>
                )}
              </div>
            ))}
            {refunds.length === 0 ? <p className="admin-muted">No refund requests.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Review Moderation</p>
          <h2>Product Reviews</h2>
          <div className="admin-list">
            {reviews.map((review) => (
              <div className="admin-order" key={review.reviewNo}>
                <div>
                  <strong>{review.reviewNo}</strong>
                  <span>
                    {review.status} 鐠?{review.productSlug} 鐠?{review.rating} stars
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
                    Publish
                  </button>
                  <button
                    className="admin-button admin-button--small admin-button--ghost"
                    disabled={busyReviewNo === review.reviewNo}
                    onClick={() => void handleReviewStatus(review.reviewNo, "hidden")}
                    type="button"
                  >
                    Hide
                  </button>
                </div>
              </div>
            ))}
            {reviews.length === 0 ? <p className="admin-muted">No reviews yet.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Catalog Operations</p>
          <h2>Products And Inventory</h2>
          <form className="admin-create-product" onSubmit={(event) => void handleCreateProduct(event)}>
            <label>
              Slug
              <input defaultValue="merchant-training-ball" name="slug" required />
            </label>
            <label>
              Title
              <input defaultValue="Merchant training ball" name="title" required />
            </label>
            <label>
              Pet type
              <select defaultValue="dog" name="petType">
                <option value="dog">dog</option>
                <option value="cat">cat</option>
                <option value="both">both</option>
              </select>
            </label>
            <label>
              Toy type
              <input defaultValue="training" name="toyType" required />
            </label>
            <label className="admin-create-product__wide">
              Description
              <textarea
                defaultValue="A merchant-created toy for catalog operations."
                name="description"
                required
                rows={2}
              />
            </label>
            <label>
              Image URL
              <input defaultValue="/brand/naigai-niangao/niangao-toy.png" name="imageUrl" required />
            </label>
            <label>
              SKU
              <input defaultValue={`MTB-${Date.now().toString().slice(-5)}`} name="skuCode" required />
            </label>
            <label>
              Variant
              <input defaultValue="Red / Small" name="variantName" required />
            </label>
            <label>
              Color
              <input defaultValue="red" name="color" />
            </label>
            <label>
              Size
              <input defaultValue="S" name="size" />
            </label>
            <label>
              Material
              <input defaultValue="rubber" name="material" />
            </label>
            <label>
              Price
              <input defaultValue="25.90" min="0.01" name="priceYuan" step="0.01" type="number" />
            </label>
            <label>
              Stock
              <input defaultValue="3" min={0} name="stock" type="number" />
            </label>
            <button className="admin-button admin-create-product__wide" disabled={isCreatingProduct} type="submit">
              {isCreatingProduct ? "Creating..." : "Create active product"}
            </button>
          </form>
          <div className="admin-inventory-alerts">
            <strong>Low-stock alerts</strong>
            {lowStock.map((variant) => (
              <span key={`${variant.productSlug}-${variant.skuCode}`}>
                {variant.skuCode}: {variant.stock}/{variant.threshold}
              </span>
            ))}
            {lowStock.length === 0 ? <span>No low-stock SKUs.</span> : null}
          </div>
          <div className="admin-list">
            {products.map((product) => (
              <div className="admin-product" key={product.slug}>
                <div>
                  <strong>{product.title}</strong>
                  <span>{product.slug} 璺?{product.status}</span>
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
                      Update stock
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
                  {product.status === "active" ? "Archive product" : "Publish product"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Fulfillment</p>
          <h2>Order Fulfillment</h2>
          <div className="admin-list">
            {orders.map((order) => (
              <div className="admin-order" key={order.orderNo}>
                <div>
                  <strong>{order.orderNo}</strong>
                  <span>{order.status} 璺?{formatCents(order.totalCents)}</span>
                </div>
                <form
                  className="admin-inline-form"
                  onSubmit={(event) => void handleFulfillment(order.orderNo, event)}
                >
                  <label>
                    Carrier
                    <input defaultValue="SF Express" name="carrier" required />
                  </label>
                  <label>
                    Tracking number
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
                    {order.shipment ? "Shipment recorded" : "Record shipment"}
                  </button>
                </form>
                {order.shipment ? (
                  <div className="admin-inline-actions">
                    <span>
                      {order.shipment.carrier} / {order.shipment.trackingNumber} /{" "}
                      {order.shipment.status}
                    </span>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyOrderNo === order.orderNo}
                      onClick={() => void handleShipmentEvent(order.orderNo, "out_for_delivery")}
                      type="button"
                    >
                      Out for delivery
                    </button>
                    <button
                      className="admin-button admin-button--small"
                      disabled={
                        order.status === "completed" || busyOrderNo === order.orderNo
                      }
                      onClick={() => void handleShipmentEvent(order.orderNo, "delivered")}
                      type="button"
                    >
                      Mark delivered
                    </button>
                    <button
                      className="admin-button admin-button--small admin-button--ghost"
                      disabled={busyOrderNo === order.orderNo}
                      onClick={() => void handleShipmentEvent(order.orderNo, "exception")}
                      type="button"
                    >
                      Exception
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {orders.length === 0 ? <p className="admin-muted">No orders yet.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Cloud Pets</p>
          <h2>Cloud-pet Profiles</h2>
          <div className="admin-inline-actions">
            <button
              className="admin-button"
              disabled={isGeneratingDailyDiaries}
              onClick={() => void handleGenerateDailyDiaries()}
              type="button"
            >
              {isGeneratingDailyDiaries
                ? "Generating daily diaries..."
                : "Generate today's diaries"}
            </button>
            {dailyDiaryGeneration ? (
              <span>
                {dailyDiaryGeneration.date}: {dailyDiaryGeneration.generatedCount} generated /{" "}
                {dailyDiaryGeneration.skippedCount} skipped
              </span>
            ) : null}
            <Link
              className="admin-button admin-button--small admin-button--ghost"
              href="/admin/pets/daily-diary-coverage"
            >
              View gaps
            </Link>
          </div>
          {dailyDiaryStatus ? (
            <div className="admin-inventory-alerts">
              <strong>
                Daily diary coverage{" "}
                {Math.round(dailyDiaryStatus.coverageRate * 100)}%
              </strong>
              <span>
                {dailyDiaryStatus.date}: {dailyDiaryStatus.generatedTodayCount}/
                {dailyDiaryStatus.totalPetCount} covered
              </span>
              <span>{dailyDiaryStatus.missingTodayCount} missing</span>
              {dailyDiaryStatus.items
                .filter((item) => item.status === "missing")
                .slice(0, 3)
                .map((item) => (
                  <span key={item.petNo}>Missing: {item.name}</span>
                ))}
            </div>
          ) : null}
          <div className="admin-list">
            {pets.map((pet) => (
              <div className="admin-row" key={pet.petNo}>
                <div>
                  <strong>{pet.name}</strong>
                  <span>{pet.petNo} 璺?{pet.species}</span>
                </div>
                <em>
                  {pet.communityPostCount} posts 璺?{pet.homepageVisitCount ?? 0} visits
                </em>
              </div>
            ))}
            {pets.length === 0 ? <p className="admin-muted">No cloud pets yet.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Community Moderation</p>
          <h2>Community Posts</h2>
          <div className="admin-list">
            {posts.map((post) => (
              <div className="admin-post" key={post.postNo}>
                <div>
                  <strong>{post.petName}</strong>
                  <span>{post.postNo} 璺?{post.status}</span>
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
                  {post.status === "hidden" ? "Restore" : "Hide"}
                </button>
              </div>
            ))}
            {posts.length === 0 ? <p className="admin-muted">No community posts.</p> : null}
          </div>
        </article>

        <article className="admin-card">
          <p className="section__kicker">Community Reports</p>
          <h2>Report Queue</h2>
          <div className="admin-list">
            {reports.map((report) => (
              <div className="admin-post" key={report.reportNo}>
                <div>
                  <strong>{report.reportNo}</strong>
                  <span>{report.status} 鐠?{report.postNo}</span>
                </div>
                <p>{report.reason}</p>
                <div className="admin-inline-actions">
                  <button
                    className="admin-button admin-button--small"
                    disabled={busyReportNo === report.reportNo}
                    onClick={() => void handleReportStatus(report.reportNo, "reviewed")}
                    type="button"
                  >
                    Mark reviewed
                  </button>
                  <button
                    className="admin-button admin-button--small admin-button--ghost"
                    disabled={busyReportNo === report.reportNo}
                    onClick={() => void handleReportStatus(report.reportNo, "dismissed")}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
            {reports.length === 0 ? <p className="admin-muted">No community reports.</p> : null}
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

