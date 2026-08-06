"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { formatCents } from "../../shop/shop-api";
import {
  getMemberCancelReasonLabel,
  getPaymentFailureLabel,
  getPaymentProviderLabel,
  getPaymentStatusLabel
} from "../../shop/shop-copy";
import {
  adminLogout,
  AdminPaymentDetail,
  AdminPaymentFailureCode,
  AdminPaymentIntent,
  AdminPaymentProvider,
  AdminPaymentStatus,
  AdminStaffProfile,
  expireOverduePayments,
  getAdminMe,
  getAdminPayment,
  listAdminPayments
} from "../admin-api";
import { getAdminRoleLabel, getAdminStaffNameLabel, getStatusLabel } from "../admin-copy";

const defaultToken = "";

type PaymentFilters = {
  orderId: string;
  status: "" | AdminPaymentStatus;
  provider: "" | AdminPaymentProvider;
  overdue: boolean;
  failureCode: "" | AdminPaymentFailureCode;
};

const defaultFilters: PaymentFilters = {
  orderId: "",
  status: "",
  provider: "",
  overdue: false,
  failureCode: ""
};

function readPaymentFilters(searchParams: URLSearchParams): PaymentFilters {
  return {
    orderId: searchParams.get("orderId") ?? "",
    status: (searchParams.get("status") ?? "") as "" | AdminPaymentStatus,
    provider: (searchParams.get("provider") ?? "") as "" | AdminPaymentProvider,
    overdue: searchParams.get("overdue") === "true",
    failureCode: (searchParams.get("failureCode") ?? "") as "" | AdminPaymentFailureCode
  };
}

function buildPaymentListUrl(filters: PaymentFilters, paymentIntentId?: string | null) {
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
  if (paymentIntentId) {
    params.set("paymentIntentId", paymentIntentId);
  }

  const query = params.toString();
  return `/admin/payments${query ? `?${query}` : ""}`;
}

function describeFailure(payment: {
  failureCode?: AdminPaymentFailureCode;
  failureMessage?: string;
}) {
  if (!payment.failureCode) {
    return null;
  }

  return getPaymentFailureLabel(payment.failureCode, payment.failureMessage);
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function describeLedgerMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return [];
  }

  const labels: Record<string, string> = {
    attemptNo: "支付次数",
    closeReason: "关闭原因",
    failureCode: "失败原因",
    failureMessage: "失败说明",
    memberCancelNote: "会员备注",
    memberCancelReason: "会员取消原因",
    previousPaymentIntentId: "上一次支付单",
    reason: "原因"
  };

  return Object.entries(metadata)
    .map(([key, value]) => {
      if (key === "failureMessage" && metadata.failureCode) {
        return null;
      }

      const formattedValue = key === "failureCode"
        ? getPaymentFailureLabel(String(value))
        : key === "memberCancelReason"
          ? getMemberCancelReasonLabel(String(value))
          : formatMetadataValue(value);
      if (!formattedValue) {
        return null;
      }

      return `${labels[key] ?? key}: ${formattedValue}`;
    })
    .filter((item): item is string => Boolean(item));
}

function getLedgerEventTypeLabel(eventType: string) {
  return {
    payment_created: "支付单已创建",
    payment_confirmed: "支付已确认",
    payment_failed: "支付失败",
    payment_expired: "支付已过期",
    payment_cancelled: "支付已取消"
  }[eventType] ?? eventType;
}

export function PaymentsConsole() {
  const [token, setToken] = useState(defaultToken);
  const [currentStaff, setCurrentStaff] = useState<AdminStaffProfile | null>(null);
  const [payments, setPayments] = useState<AdminPaymentIntent[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentDetail | null>(null);
  const [filters, setFilters] = useState<PaymentFilters>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expireLoading, setExpireLoading] = useState(false);
  const [expireSummary, setExpireSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("正在加载支付流水...");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("kzt_admin_session") ?? defaultToken;
    const searchParams = new URLSearchParams(window.location.search);
    const queryPaymentIntentId = searchParams.get("paymentIntentId");
    const queryFilters = readPaymentFilters(searchParams);
    setToken(storedToken);
    setFilters(queryFilters);
    if (queryPaymentIntentId) {
      setSelectedPaymentId(queryPaymentIntentId);
    }
    if (storedToken) {
      void loadPayments(storedToken, queryPaymentIntentId ?? undefined, queryFilters);
    } else {
      setLoading(false);
    }
  }, []);

  async function loadPayments(
    nextToken = token,
    nextSelectedPaymentId = selectedPaymentId,
    nextFilters = filters
  ) {
    if (!nextToken) {
      setLoading(false);
      setError("需要后台登录会话");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [staff, items] = await Promise.all([
        getAdminMe(nextToken),
        listAdminPayments(
          nextToken,
          {
            orderId: nextFilters.orderId || undefined,
            provider: nextFilters.provider || undefined,
            status: nextFilters.status || undefined,
            overdue: nextFilters.overdue,
            failureCode: nextFilters.failureCode || undefined
          }
        )
      ]);
      setCurrentStaff(staff);
      setPayments(items);
      setStatusText(`已加载 ${items.length} 条支付单。`);

      if (nextSelectedPaymentId) {
        await loadPaymentDetail(nextSelectedPaymentId, nextToken, nextFilters);
      }
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

      setError(caught instanceof Error ? caught.message : "支付流水加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadPaymentDetail(paymentIntentId: string, nextToken = token, nextFilters = filters) {
    setDetailLoading(true);
    setError(null);

    try {
      const detail = await getAdminPayment(paymentIntentId, nextToken);
      setSelectedPaymentId(paymentIntentId);
      setSelectedPayment(detail);
      window.history.replaceState({}, "", buildPaymentListUrl(nextFilters, paymentIntentId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "支付详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCopy(value: string) {
    if (!navigator.clipboard?.writeText) {
      setError("当前浏览器不支持剪贴板。");
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(null), 1200);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedPayment(null);
    setSelectedPaymentId(null);
    window.history.replaceState({}, "", buildPaymentListUrl(filters));
    await loadPayments(token, null, filters);
  }

  function handleResetFilters() {
    window.location.href = "/admin/payments";
  }

  async function handleExpireOverdue() {
    if (!token) {
      setError("需要后台登录会话");
      return;
    }

    setExpireLoading(true);
    setError(null);
    setExpireSummary(null);

    try {
      const result = await expireOverduePayments(token, { limit: 50 });
      setExpireSummary(
        `已扫描 ${result.scannedCount} 条；过期 ${result.expiredIntentCount} 条；关闭订单 ${result.closedOrderCount} 笔；释放库存 ${result.inventoryReleasedCount} 件；跳过 ${result.skippedCount} 条；失败 ${result.failedCount} 条。`
      );
      await loadPayments(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "逾期支付处理失败");
    } finally {
      setExpireLoading(false);
    }
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

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">支付流水</p>
          <h2>支付单与事件账本</h2>
          <p>集中查看订单支付、渠道状态和追加式流水事件。</p>
        </div>
        <div className="admin-token-form">
          <div>
            <strong>{currentStaff ? getAdminStaffNameLabel(currentStaff.name) : "员工会话"}</strong>
            <span>{currentStaff ? getAdminRoleLabel(currentStaff.role) : "校验中"}</span>
          </div>
          <button className="admin-button" onClick={() => void loadPayments(token)} type="button">
            刷新支付流水
          </button>
          <button className="admin-button" disabled={expireLoading} onClick={() => void handleExpireOverdue()} type="button">
            {expireLoading ? "处理中..." : "处理逾期支付"}
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            退出登录
          </button>
        </div>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin">
            返回仪表盘
          </Link>
        </div>
        <p className={error ? "admin-status admin-status--error" : "admin-status"}>
          {error ?? expireSummary ?? (loading ? "正在加载支付流水..." : statusText)}
        </p>
      </section>

      <section className="admin-card">
        <p className="section__kicker">筛选</p>
        <h2>查询支付单</h2>
        <form className="admin-inline-actions" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            订单号
            <input
              onChange={(event) =>
                setFilters((current) => ({ ...current, orderId: event.target.value }))
              }
              value={filters.orderId}
            />
          </label>
          <label>
            状态
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as "" | AdminPaymentStatus
                }))
              }
              value={filters.status}
            >
              <option value="">全部</option>
              <option value="created">已创建</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="failed">支付失败</option>
              <option value="expired">已过期</option>
              <option value="cancelled">已取消</option>
            </select>
          </label>
          <label>
            支付渠道
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  provider: event.target.value as "" | AdminPaymentProvider
                }))
              }
              value={filters.provider}
            >
              <option value="">全部</option>
              <option value="mock_wechat">模拟微信</option>
              <option value="mock_alipay">模拟支付宝</option>
            </select>
          </label>
          <label>
            失败原因
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  failureCode: event.target.value as "" | AdminPaymentFailureCode
                }))
              }
              value={filters.failureCode}
            >
              <option value="">全部</option>
              <option value="INSUFFICIENT_BALANCE">余额不足</option>
              <option value="PAYMENT_DECLINED">支付被拒绝</option>
              <option value="PROVIDER_UNAVAILABLE">支付渠道不可用</option>
              <option value="USER_CANCELLED_PAYMENT">用户取消支付</option>
              <option value="UNKNOWN_PROVIDER_ERROR">未知渠道错误</option>
            </select>
          </label>
          <label>
            <input
              checked={filters.overdue}
              onChange={(event) =>
                setFilters((current) => ({ ...current, overdue: event.target.checked }))
              }
              type="checkbox"
            />
            仅看逾期
          </label>
          <button className="admin-button" disabled={loading} type="submit">
            应用筛选
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={handleResetFilters}
            type="button"
          >
            重置
          </button>
        </form>
      </section>

      <section className="admin-card">
        <p className="section__kicker">支付列表</p>
        <h2>支付流水概览</h2>
        {payments.length === 0 && !loading ? (
          <p className="admin-muted">没有符合当前筛选条件的支付单。</p>
        ) : null}
        <div className="admin-list">
          {payments.map((payment) => {
            const failureText = describeFailure(payment);

            return (
              <button
                className="admin-row"
                key={payment.id}
                onClick={() => void loadPaymentDetail(payment.id, token)}
                type="button"
              >
                <div>
                  <strong>{payment.id}</strong>
                  <span>
                    {payment.orderId} / {payment.memberId} / {getPaymentProviderLabel(payment.provider)}
                  </span>
                  <p>
                    第 {payment.attemptNo} 次 / {getPaymentStatusLabel(payment.status)} / {formatCents(payment.amount)} / {payment.providerTradeNo ?? "暂无渠道流水号"}
                  </p>
                  <p>
                    过期时间 {payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : "未设置"} / {payment.remainingSeconds === 0 ? "已逾期" : payment.remainingSeconds ? `剩余 ${payment.remainingSeconds} 秒` : payment.orderCloseReason ?? getStatusLabel(payment.orderStatus)}
                  </p>
                  {failureText ? <p>失败原因：{failureText}</p> : null}
                  {payment.orderMemberCancelReason ? (
                    <p>
                      取消原因：{getMemberCancelReasonLabel(payment.orderMemberCancelReason)}
                      {payment.orderMemberCancelNote ? ` / ${payment.orderMemberCancelNote}` : ""}
                    </p>
                  ) : null}
                </div>
                <em>
                  {payment.paidAt
                    ? `支付于 ${new Date(payment.paidAt).toLocaleString()}`
                    : payment.failedAt
                      ? `失败于 ${new Date(payment.failedAt).toLocaleString()}`
                      : payment.cancelledAt
                        ? `取消于 ${new Date(payment.cancelledAt).toLocaleString()}`
                        : new Date(payment.createdAt).toLocaleString()}
                </em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">支付详情</p>
        <h2>支付单与流水事件</h2>
        {detailLoading ? <p className="admin-muted">正在加载支付详情...</p> : null}
        {!detailLoading && !selectedPayment ? (
          <p className="admin-muted">请选择一条支付单查看流水事件。</p>
        ) : null}
        {selectedPayment ? (
          <>
            <div className="admin-metrics">
              <article className="admin-metric admin-metric--with-action">
                <span>支付单</span>
                <strong>{selectedPayment.paymentIntent.id}</strong>
                <button
                  aria-label="复制支付单号"
                  className="admin-copy-button"
                  onClick={() => void handleCopy(selectedPayment.paymentIntent.id)}
                  title="复制支付单号"
                  type="button"
                >
                  <Copy size={14} />
                </button>
                {copiedValue === selectedPayment.paymentIntent.id ? <small>已复制</small> : null}
              </article>
              <article className="admin-metric">
                <span>状态</span>
                <strong>{getPaymentStatusLabel(selectedPayment.paymentIntent.status)}</strong>
              </article>
              <article className="admin-metric admin-metric--with-action">
                <span>订单</span>
                <strong>{selectedPayment.paymentIntent.orderId}</strong>
                <button
                  aria-label="复制订单号"
                  className="admin-copy-button"
                  onClick={() => void handleCopy(selectedPayment.paymentIntent.orderId)}
                  title="复制订单号"
                  type="button"
                >
                  <Copy size={14} />
                </button>
                {copiedValue === selectedPayment.paymentIntent.orderId ? <small>已复制</small> : null}
              </article>
              <article className="admin-metric">
                <span>金额</span>
                <strong>{formatCents(selectedPayment.paymentIntent.amount)}</strong>
              </article>
              <article className="admin-metric">
                <span>过期时间</span>
                <strong>{selectedPayment.paymentIntent.expiresAt ? new Date(selectedPayment.paymentIntent.expiresAt).toLocaleString() : "未设置"}</strong>
              </article>
            </div>
            {describeFailure(selectedPayment.paymentIntent) ? (
              <p className="admin-muted">失败原因：{describeFailure(selectedPayment.paymentIntent)}</p>
            ) : null}
            {selectedPayment.paymentIntent.orderMemberCancelReason ? (
              <p className="admin-muted">
                取消原因：{getMemberCancelReasonLabel(selectedPayment.paymentIntent.orderMemberCancelReason)}
                {selectedPayment.paymentIntent.orderMemberCancelNote ? ` / ${selectedPayment.paymentIntent.orderMemberCancelNote}` : ""}
              </p>
            ) : null}
            {selectedPayment.relatedIntents?.length ? (
              <div className="admin-list">
                {selectedPayment.relatedIntents.map((intent) => (
                  <button
                    className="admin-row"
                    key={intent.id}
                    onClick={() => void loadPaymentDetail(intent.id, token)}
                    type="button"
                  >
                    <div>
                      <strong>第 {intent.attemptNo} 次支付</strong>
                      <span>
                        {intent.id} / {getPaymentProviderLabel(intent.provider)} / {getPaymentStatusLabel(intent.status)}
                      </span>
                      <p>{describeFailure(intent) ?? (intent.previousPaymentIntentId ? `上一次支付单 ${intent.previousPaymentIntentId}` : "暂无失败记录")}</p>
                      {selectedPayment.paymentIntent.id === intent.id ? (
                        <p>当前详情</p>
                      ) : null}
                    </div>
                    <em>{new Date(intent.createdAt).toLocaleString()}</em>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="admin-list">
              {selectedPayment.ledger.map((entry) => {
                const metadataLines = describeLedgerMetadata(entry.metadata);

                return (
                  <div className="admin-row" key={entry.id}>
                    <div>
                      <strong>{getLedgerEventTypeLabel(entry.eventType)}</strong>
                      <span>
                        {getStatusLabel(entry.status)} / {getPaymentProviderLabel(entry.provider)} / {entry.providerTradeNo ?? "暂无渠道流水号"}
                      </span>
                      <p>{entry.idempotencyKey}</p>
                      {metadataLines.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                    <em>{new Date(entry.createdAt).toLocaleString()}</em>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
