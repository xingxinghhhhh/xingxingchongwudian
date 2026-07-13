"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { formatCents } from "../../shop/shop-api";
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

const failureReasonLabels: Record<AdminPaymentFailureCode, string> = {
  INSUFFICIENT_BALANCE: "Insufficient balance",
  PAYMENT_DECLINED: "Payment declined",
  PROVIDER_UNAVAILABLE: "Provider unavailable",
  USER_CANCELLED_PAYMENT: "User cancelled payment",
  UNKNOWN_PROVIDER_ERROR: "Unknown provider error"
};

function describeFailure(payment: {
  failureCode?: AdminPaymentFailureCode;
  failureMessage?: string;
}) {
  if (!payment.failureCode) {
    return null;
  }

  const label = failureReasonLabels[payment.failureCode] ?? payment.failureCode;
  return payment.failureMessage ? `${label} / ${payment.failureMessage}` : label;
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
    attemptNo: "Attempt",
    closeReason: "Close reason",
    failureCode: "Failure code",
    failureMessage: "Failure message",
    memberCancelNote: "Member note",
    memberCancelReason: "Member reason",
    previousPaymentIntentId: "Previous intent",
    reason: "Reason"
  };

  return Object.entries(metadata)
    .map(([key, value]) => {
      const formattedValue = formatMetadataValue(value);
      if (!formattedValue) {
        return null;
      }

      return `${labels[key] ?? key}: ${formattedValue}`;
    })
    .filter((item): item is string => Boolean(item));
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
  const [statusText, setStatusText] = useState("Loading payment ledger.");
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
      setError("Admin session required");
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
      setStatusText(`Loaded ${items.length} payment intents.`);

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

      setError(caught instanceof Error ? caught.message : "Failed to load payments");
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
      setError(caught instanceof Error ? caught.message : "Failed to load payment detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleCopy(value: string) {
    if (!navigator.clipboard?.writeText) {
      setError("Clipboard is not available in this browser.");
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
      setError("Admin session required");
      return;
    }

    setExpireLoading(true);
    setError(null);
    setExpireSummary(null);

    try {
      const result = await expireOverduePayments(token, { limit: 50 });
      setExpireSummary(
        `Scanned ${result.scannedCount}; expired ${result.expiredIntentCount}; closed ${result.closedOrderCount}; inventory released ${result.inventoryReleasedCount}; skipped ${result.skippedCount}; failed ${result.failedCount}.`
      );
      await loadPayments(token);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to expire overdue payments");
    } finally {
      setExpireLoading(false);
    }
  }

  async function handleLogout() {
    if (token) {
      try {
        await adminLogout(token);
      } catch {
        // Ignore logout failure and clear local session anyway.
      }
    }

    localStorage.removeItem("kzt_admin_session");
    window.location.href = "/admin/login";
  }

  return (
    <div className="admin-console">
      <section className="admin-card admin-card--token">
        <div>
          <p className="section__kicker">Payments</p>
          <h2>Payment Intent Ledger</h2>
          <p>Track order payments, provider states, and ledger events in one place.</p>
        </div>
        <div className="admin-token-form">
          <div>
            <strong>{currentStaff?.name ?? "Staff session"}</strong>
            <span>{currentStaff ? currentStaff.role : "validating"}</span>
          </div>
          <button className="admin-button" onClick={() => void loadPayments(token)} type="button">
            Refresh payments
          </button>
          <button className="admin-button" disabled={expireLoading} onClick={() => void handleExpireOverdue()} type="button">
            {expireLoading ? "Processing..." : "Process overdue payments"}
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={() => void handleLogout()}
            type="button"
          >
            Sign out
          </button>
        </div>
        <div className="admin-inline-actions">
          <Link className="admin-button admin-button--ghost" href="/admin">
            Back to dashboard
          </Link>
        </div>
        <p className={error ? "admin-status admin-status--error" : "admin-status"}>
          {error ?? expireSummary ?? (loading ? "Loading payments..." : statusText)}
        </p>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Filters</p>
        <h2>Search Payment Intents</h2>
        <form className="admin-inline-actions" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Order No
            <input
              onChange={(event) =>
                setFilters((current) => ({ ...current, orderId: event.target.value }))
              }
              value={filters.orderId}
            />
          </label>
          <label>
            Status
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as "" | AdminPaymentStatus
                }))
              }
              value={filters.status}
            >
              <option value="">All</option>
              <option value="created">created</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="failed">failed</option>
              <option value="expired">expired</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label>
            Provider
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  provider: event.target.value as "" | AdminPaymentProvider
                }))
              }
              value={filters.provider}
            >
              <option value="">All</option>
              <option value="mock_wechat">mock_wechat</option>
              <option value="mock_alipay">mock_alipay</option>
            </select>
          </label>
          <label>
            Failure
            <select
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  failureCode: event.target.value as "" | AdminPaymentFailureCode
                }))
              }
              value={filters.failureCode}
            >
              <option value="">All</option>
              <option value="INSUFFICIENT_BALANCE">INSUFFICIENT_BALANCE</option>
              <option value="PAYMENT_DECLINED">PAYMENT_DECLINED</option>
              <option value="PROVIDER_UNAVAILABLE">PROVIDER_UNAVAILABLE</option>
              <option value="USER_CANCELLED_PAYMENT">USER_CANCELLED_PAYMENT</option>
              <option value="UNKNOWN_PROVIDER_ERROR">UNKNOWN_PROVIDER_ERROR</option>
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
            Overdue only
          </label>
          <button className="admin-button" disabled={loading} type="submit">
            Apply filters
          </button>
          <button
            className="admin-button admin-button--ghost"
            onClick={handleResetFilters}
            type="button"
          >
            Reset
          </button>
        </form>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Payment List</p>
        <h2>Ledger Overview</h2>
        {payments.length === 0 && !loading ? (
          <p className="admin-muted">No payment intents matched these filters.</p>
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
                    {payment.orderId} / {payment.memberId} / {payment.provider}
                  </span>
                  <p>
                    Attempt {payment.attemptNo} / {payment.status} / {formatCents(payment.amount)} / {payment.providerTradeNo ?? "No provider trade no"}
                  </p>
                  <p>
                    Expires {payment.expiresAt ? new Date(payment.expiresAt).toLocaleString() : "not set"} / {payment.remainingSeconds === 0 ? "overdue" : payment.remainingSeconds ? `${payment.remainingSeconds}s left` : payment.orderCloseReason ?? payment.orderStatus}
                  </p>
                  {failureText ? <p>Failure {failureText}</p> : null}
                  {payment.orderMemberCancelReason ? (
                    <p>
                      Cancel reason {payment.orderMemberCancelReason}
                      {payment.orderMemberCancelNote ? ` / ${payment.orderMemberCancelNote}` : ""}
                    </p>
                  ) : null}
                </div>
                <em>
                  {payment.paidAt
                    ? `Paid ${new Date(payment.paidAt).toLocaleString()}`
                    : payment.failedAt
                      ? `Failed ${new Date(payment.failedAt).toLocaleString()}`
                      : payment.cancelledAt
                        ? `Cancelled ${new Date(payment.cancelledAt).toLocaleString()}`
                        : new Date(payment.createdAt).toLocaleString()}
                </em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="admin-card">
        <p className="section__kicker">Payment Detail</p>
        <h2>Intent And Ledger Events</h2>
        {detailLoading ? <p className="admin-muted">Loading payment detail...</p> : null}
        {!detailLoading && !selectedPayment ? (
          <p className="admin-muted">Select a payment intent to inspect ledger events.</p>
        ) : null}
        {selectedPayment ? (
          <>
            <div className="admin-metrics">
              <article className="admin-metric admin-metric--with-action">
                <span>Intent</span>
                <strong>{selectedPayment.paymentIntent.id}</strong>
                <button
                  aria-label="Copy payment intent id"
                  className="admin-copy-button"
                  onClick={() => void handleCopy(selectedPayment.paymentIntent.id)}
                  title="Copy payment intent id"
                  type="button"
                >
                  <Copy size={14} />
                </button>
                {copiedValue === selectedPayment.paymentIntent.id ? <small>Copied</small> : null}
              </article>
              <article className="admin-metric">
                <span>Status</span>
                <strong>{selectedPayment.paymentIntent.status}</strong>
              </article>
              <article className="admin-metric admin-metric--with-action">
                <span>Order</span>
                <strong>{selectedPayment.paymentIntent.orderId}</strong>
                <button
                  aria-label="Copy order id"
                  className="admin-copy-button"
                  onClick={() => void handleCopy(selectedPayment.paymentIntent.orderId)}
                  title="Copy order id"
                  type="button"
                >
                  <Copy size={14} />
                </button>
                {copiedValue === selectedPayment.paymentIntent.orderId ? <small>Copied</small> : null}
              </article>
              <article className="admin-metric">
                <span>Amount</span>
                <strong>{formatCents(selectedPayment.paymentIntent.amount)}</strong>
              </article>
              <article className="admin-metric">
                <span>Expires</span>
                <strong>{selectedPayment.paymentIntent.expiresAt ? new Date(selectedPayment.paymentIntent.expiresAt).toLocaleString() : "not set"}</strong>
              </article>
            </div>
            {describeFailure(selectedPayment.paymentIntent) ? (
              <p className="admin-muted">Failure: {describeFailure(selectedPayment.paymentIntent)}</p>
            ) : null}
            {selectedPayment.paymentIntent.orderMemberCancelReason ? (
              <p className="admin-muted">
                Cancellation: {selectedPayment.paymentIntent.orderMemberCancelReason}
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
                      <strong>Attempt {intent.attemptNo}</strong>
                      <span>
                        {intent.id} / {intent.provider} / {intent.status}
                      </span>
                      <p>{describeFailure(intent) ?? (intent.previousPaymentIntentId ? `Previous attempt ${intent.previousPaymentIntentId}` : "No failure recorded")}</p>
                      {selectedPayment.paymentIntent.id === intent.id ? (
                        <p>Current detail</p>
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
                      <strong>{entry.eventType}</strong>
                      <span>
                        {entry.status} / {entry.provider} / {entry.providerTradeNo ?? "No provider trade no"}
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


