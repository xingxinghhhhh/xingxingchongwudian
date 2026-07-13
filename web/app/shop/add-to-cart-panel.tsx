"use client";

import { ShoppingCart } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { loginMember } from "../member/member-api";
import {
  cancelOrder,
  CartResponse,
  CheckoutCartInput,
  MemberCancelReason,
  OrderPaymentAttemptResponse,
  OrderResponse,
  PaymentFailureCode,
  PaymentIntentResponse,
  PaymentProvider,
  ProductReviewsResponse,
  ShopProductDetail,
  addCartItem,
  checkoutCart,
  confirmPaymentIntent,
  createPaymentIntent,
  createProductReview,
  formatCents,
  getOrder,
  getOrderPaymentAttempts,
  getPaymentIntent,
  listProductReviews
} from "./shop-api";
interface AddToCartPanelProps {
  products: ShopProductDetail[];
}

const defaultCheckoutForm: CheckoutCartInput = {
  couponCode: "WELCOME20",
  customer: {
    name: "Demo Customer",
    phone: "13800138000"
  },
  address: {
    receiverName: "Demo Customer",
    phone: "13800138000",
    province: "Guangdong",
    city: "Shenzhen",
    district: "Nanshan",
    detail: "Science Park 1"
  }
};

const defaultCancelReason: MemberCancelReason = "ORDER_CREATED_BY_MISTAKE";

const cancelReasonLabels: Record<MemberCancelReason, string> = {
  ORDER_CREATED_BY_MISTAKE: "Created by mistake",
  CHANGED_MIND: "Changed my mind",
  WRONG_PRODUCT: "Selected the wrong product",
  WRONG_ADDRESS: "Shipping address is wrong",
  FOUND_BETTER_OPTION: "Found a better option",
  OTHER: "Other"
};
const paymentFailureLabels: Record<PaymentFailureCode, string> = {
  INSUFFICIENT_BALANCE: "Insufficient balance. Please choose another payment method or try again.",
  PAYMENT_DECLINED: "The payment was declined. Please retry the payment.",
  PROVIDER_UNAVAILABLE: "The payment service is temporarily unavailable. Please try again shortly.",
  USER_CANCELLED_PAYMENT: "This payment attempt was cancelled. The order can still be paid.",
  UNKNOWN_PROVIDER_ERROR: "The payment failed. Please create a new payment attempt."
};

function formatPaymentFailure(
  failureCode?: PaymentFailureCode,
  fallback?: string
) {
  if (failureCode && paymentFailureLabels[failureCode]) {
    return paymentFailureLabels[failureCode];
  }

  return fallback ?? "The payment failed. Please create a new payment attempt.";
}

export function AddToCartPanel({ products }: AddToCartPanelProps) {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [payment, setPayment] = useState<PaymentIntentResponse | null>(null);
  const [paymentAttempts, setPaymentAttempts] = useState<OrderPaymentAttemptResponse[]>([]);
  const [reviewsBySlug, setReviewsBySlug] = useState<
    Record<string, ProductReviewsResponse>
  >({});
  const [paymentProvider, setPaymentProvider] =
    useState<PaymentProvider>("wechat");
  const [busySku, setBusySku] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isRefreshingExpiredPayment, setIsRefreshingExpiredPayment] = useState(false);
  const [cancelReason, setCancelReason] = useState<MemberCancelReason>(defaultCancelReason);
  const [cancelNote, setCancelNote] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [message, setMessage] = useState("Pick a product to start checkout.");
  const [error, setError] = useState<string | null>(null);
  const [checkoutForm, setCheckoutForm] =
    useState<CheckoutCartInput>(defaultCheckoutForm);

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      const entries = await Promise.all(
        products.map(async (product) => [
          product.slug,
          await listProductReviews(product.slug)
        ] as const)
      );

      if (active) {
        setReviewsBySlug(Object.fromEntries(entries));
      }
    }

    void loadReviews().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [products]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, []);
  const paymentRemainingSeconds = payment?.expiresAt
    ? Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - nowTick) / 1000))
    : payment?.remainingSeconds;
  const isPaymentExpired = payment?.status === "expired" || paymentRemainingSeconds === 0;

  useEffect(() => {
    if (
      !payment ||
      !order ||
      isRefreshingExpiredPayment ||
      paymentRemainingSeconds !== 0 ||
      !["created", "pending"].includes(payment.status)
    ) {
      return;
    }

    let active = true;
    const paymentIntentId = payment.id;
    const orderNo = order.orderNo;
    async function refreshExpiredPaymentState() {
      setIsRefreshingExpiredPayment(true);

      try {
        const sessionToken = await ensureMemberSession();
        const [nextPayment, nextOrder, nextAttempts] = await Promise.all([
          getPaymentIntent(paymentIntentId, sessionToken),
          getOrder(orderNo),
          getOrderPaymentAttempts(orderNo, sessionToken)
        ]);

        if (!active) {
          return;
        }

        setPayment(nextPayment);
        setOrder(nextOrder);
        setPaymentAttempts(nextAttempts.attempts);

        if (
          nextPayment.status === "expired" ||
          nextOrder.closeReason === "PAYMENT_TIMEOUT"
        ) {
          setMessage(
            `Order ${nextOrder.orderNo} payment expired and was closed. Start a new order to continue checkout.`
          );
        }
      } catch {
        if (active) {
          setError("Failed to refresh the expired payment state.");
        }
      } finally {
        if (active) {
          setIsRefreshingExpiredPayment(false);
        }
      }
    }

    void refreshExpiredPaymentState();

    return () => {
      active = false;
    };
  }, [
    isRefreshingExpiredPayment,
    order,
    payment,
    paymentRemainingSeconds
  ]);

  async function ensureMemberSession() {
    const storedSession = localStorage.getItem("kzt_member_session");

    if (storedSession) {
      return storedSession;
    }

    const login = await loginMember({
      name: checkoutForm.customer.name,
      phone: checkoutForm.customer.phone
    });
    localStorage.setItem("kzt_member_session", login.sessionToken);
    localStorage.setItem("kzt_member_name", login.member.name);
    localStorage.setItem("kzt_member_phone", login.member.phone);
    return login.sessionToken;
  }

  async function refreshPaymentAttempts(orderNo: string, sessionToken: string) {
    const attempts = await getOrderPaymentAttempts(orderNo, sessionToken);
    setPaymentAttempts(attempts.attempts);
    return attempts.attempts;
  }
  async function handleAdd(product: ShopProductDetail) {
    const variant = product.variants.find((item) => item.isAvailable);

    if (!variant) {
      setError("This product is currently out of stock.");
      return;
    }

    setBusySku(variant.skuCode);
    setError(null);

    try {
      const storedCartId =
        cart?.cartId ?? localStorage.getItem("kzt_cart_id") ?? undefined;
      let nextCart: CartResponse;

      try {
        nextCart = await addCartItem({
          cartId: storedCartId,
          quantity: 1,
          skuCode: variant.skuCode
        });
      } catch (caught) {
        if (
          storedCartId &&
          caught instanceof Error &&
          caught.message === "Cart not found"
        ) {
          localStorage.removeItem("kzt_cart_id");
          nextCart = await addCartItem({
            quantity: 1,
            skuCode: variant.skuCode
          });
        } else {
          throw caught;
        }
      }

      localStorage.setItem("kzt_cart_id", nextCart.cartId);
      setCart(nextCart);
      setOrder(null);
      setPayment(null);
      setMessage(`${product.title} added to cart.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to add item.");
    } finally {
      setBusySku(null);
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cart || cart.items.length === 0) {
      setError("Add at least one item before checkout.");
      return;
    }

    setIsCheckingOut(true);
    setError(null);

    try {
      const nextOrder = await checkoutCart(cart.cartId, checkoutForm);
      setOrder(nextOrder);
      setPayment(null);
      setCart({
        cartId: cart.cartId,
        items: [],
        subtotalCents: 0
      });
      localStorage.removeItem("kzt_cart_id");
      setMessage(`Order ${nextOrder.orderNo} created. Choose a payment method.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout failed.");
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleCreatePayment() {
    if (!order) {
      setError("Create an order before paying.");
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const sessionToken = await ensureMemberSession();
      const nextPayment = await createPaymentIntent({
        orderId: order.orderNo,
        provider: paymentProvider === "wechat" ? "mock_wechat" : "mock_alipay",
        sessionToken
      });
      await refreshPaymentAttempts(order.orderNo, sessionToken);
      setPayment(nextPayment);
      setMessage(
        nextPayment.attemptNo > 1
          ? `Payment attempt ${nextPayment.attemptNo} is ready.`
          : `${paymentProvider === "wechat" ? "WeChat" : "Alipay"} payment intent ready.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to create payment intent.");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleConfirmPayment(result: "success" | "failed") {
    if (!payment) {
      setError("Create a payment intent first.");
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const sessionToken = await ensureMemberSession();
      await confirmPaymentIntent({
        paymentIntentId: payment.id,
        result,
        sessionToken
      });
      const [nextPayment, nextOrder, nextAttempts] = await Promise.all([
        getPaymentIntent(payment.id, sessionToken),
        getOrder(payment.orderId),
        getOrderPaymentAttempts(payment.orderId, sessionToken)
      ]);
      setPayment(nextPayment);
      setOrder(nextOrder);
      setPaymentAttempts(nextAttempts.attempts);
      setMessage(
        result === "success"
          ? `Order ${nextOrder.orderNo} payment confirmed.`
          : nextPayment.status === "expired"
            ? `Order ${nextOrder.orderNo} payment expired. Please place a new order.`
            : formatPaymentFailure(nextPayment.failureCode, nextPayment.failureMessage)
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to confirm payment.");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) {
      setError("Create an order before cancelling it.");
      return;
    }

    setIsCancellingOrder(true);
    setError(null);

    try {
      const sessionToken = await ensureMemberSession();
      const cancelResult = await cancelOrder({
        note: cancelNote.trim() || undefined,
        orderId: order.orderNo,
        reason: cancelReason,
        sessionToken
      });
      const [nextOrder, nextAttempts] = await Promise.all([
        getOrder(order.orderNo),
        getOrderPaymentAttempts(order.orderNo, sessionToken)
      ]);
      const nextPayment = payment
        ? await getPaymentIntent(payment.id, sessionToken)
        : null;
      setOrder(nextOrder);
      setPayment(nextPayment);
      setPaymentAttempts(nextAttempts.attempts);
      setMessage(
        cancelResult.inventoryReleased
          ? `Order ${order.orderNo} cancelled and inventory released.`
          : `Order ${order.orderNo} cancelled.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to cancel order.");
    } finally {
      setIsCancellingOrder(false);
    }
  }

  function handleRestartCheckoutFlow() {
    setOrder(null);
    setPayment(null);
    setPaymentAttempts([]);
    setCancelNote("");
    setCancelReason(defaultCancelReason);
    setError(null);
    setMessage("Start a new order by adding items to the cart again.");
  }
  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSubmittingReview(true);
    setError(null);

    try {
      const review = await createProductReview({
        orderNo: String(formData.get("orderNo") ?? ""),
        skuCode: String(formData.get("skuCode") ?? ""),
        rating: Number(formData.get("rating")),
        body: String(formData.get("body") ?? ""),
        authorName: checkoutForm.customer.name
      });
      const product = products.find((item) =>
        item.variants.some((variant) => variant.skuCode === review.skuCode)
      );

      if (product) {
        setReviewsBySlug((current) => ({
          ...current,
          [product.slug]: {
            summary: current[product.slug]?.summary ?? {
              averageRating: 0,
              reviewCount: 0
            },
            items: [review, ...(current[product.slug]?.items ?? [])]
          }
        }));
      }

      setMessage("Review submitted. It will appear after moderation.");
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Review submission failed.");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  function updateCustomer(field: keyof CheckoutCartInput["customer"], value: string) {
    setCheckoutForm((current) => ({
      ...current,
      customer: {
        ...current.customer,
        [field]: value
      }
    }));
  }

  function updateCouponCode(value: string) {
    setCheckoutForm((current) => ({
      ...current,
      couponCode: value.trim().toUpperCase()
    }));
  }

  const canCancelOrder =
    order?.status === "pending_payment" &&
    payment?.status !== "paid" &&
    payment?.status !== "cancelled";
  const canRetryPayment = Boolean(
    payment?.canRetry && order?.status === "pending_payment"
  );
  const canRestartAfterTimeout = Boolean(
    order?.status === "cancelled" &&
      (payment?.status === "expired" || order?.closeReason === "PAYMENT_TIMEOUT")
  );


  function updateAddress(field: keyof CheckoutCartInput["address"], value: string) {
    setCheckoutForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [field]: value
      }
    }));
  }

  return (
    <div className="shop-grid">
      <section className="shop-products" aria-label="Product list">
        {products.map((product) => {
          const variant = product.variants.find((item) => item.isAvailable);
          const isBusy = variant?.skuCode === busySku;
          const reviewSummary = reviewsBySlug[product.slug]?.summary;

          return (
            <article className="shop-product" key={product.slug}>
              {reviewSummary && reviewSummary.reviewCount > 0 ? (
                <p className="shop-product__type">
                  {reviewSummary.averageRating} / {reviewSummary.reviewCount} reviews
                </p>
              ) : null}
              <div className="shop-product__imageWrap">
                <img
                  alt={product.title}
                  className="shop-product__image"
                  src={product.coverImageUrl}
                />
              </div>
              <div className="shop-product__body">
                <p className="shop-product__type">
                  {product.petType} / {product.toyType}
                </p>
                {(product.tags ?? []).length > 0 ? (
                  <div className="shop-product__tags" aria-label="Product tags">
                    {product.tags.slice(0, 4).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
                <h2>{product.title}</h2>
                <p>{product.description}</p>
                <div className="shop-product__meta">
                  <strong>{formatCents(product.priceCents)}</strong>
                  <span>{variant ? `Stock ${variant.stock}` : "Out of stock"}</span>
                </div>
                <button
                  className="shop-product__button"
                  data-testid={`add-${product.slug}`}
                  disabled={!variant || isBusy}
                  onClick={() => void handleAdd(product)}
                  type="button"
                >
                  <ShoppingCart size={16} />
                  {isBusy ? "Adding..." : "Add to cart"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <aside className="shop-cart" aria-live="polite">
        <div>
          <p className="shop-cart__eyebrow">Cart</p>
          <h2>Checkout</h2>
        </div>
        <p className={error ? "shop-cart__error" : "shop-cart__message"}>
          {error ?? message}
        </p>
        {cart ? (
          <div className="shop-cart__summary">
            <span>{cart.items.length} items</span>
            <strong>{formatCents(cart.subtotalCents)}</strong>
          </div>
        ) : (
          <div className="shop-cart__summary shop-cart__summary--empty">
            <span>No items yet</span>
            <strong>{formatCents(0)}</strong>
          </div>
        )}

        <form className="shop-checkout" onSubmit={(event) => void handleCheckout(event)}>
          <h3>Shipping details</h3>
          <label>
            Coupon code
            <input
              onChange={(event) => updateCouponCode(event.target.value)}
              placeholder="WELCOME20"
              value={checkoutForm.couponCode ?? ""}
            />
          </label>
          <label>
            Customer name
            <input
              onChange={(event) => updateCustomer("name", event.target.value)}
              required
              value={checkoutForm.customer.name}
            />
          </label>
          <label>
            Customer phone
            <input
              inputMode="tel"
              onChange={(event) => {
                updateCustomer("phone", event.target.value);
                updateAddress("phone", event.target.value);
              }}
              required
              value={checkoutForm.customer.phone}
            />
          </label>
          <label>
            Receiver name
            <input
              onChange={(event) => updateAddress("receiverName", event.target.value)}
              required
              value={checkoutForm.address.receiverName}
            />
          </label>
          <div className="shop-checkout__region">
            <label>
              Province
              <input
                onChange={(event) => updateAddress("province", event.target.value)}
                required
                value={checkoutForm.address.province}
              />
            </label>
            <label>
              City
              <input
                onChange={(event) => updateAddress("city", event.target.value)}
                required
                value={checkoutForm.address.city}
              />
            </label>
            <label>
              District
              <input
                onChange={(event) => updateAddress("district", event.target.value)}
                required
                value={checkoutForm.address.district}
              />
            </label>
          </div>
          <label>
            Street address
            <textarea
              onChange={(event) => updateAddress("detail", event.target.value)}
              required
              rows={3}
              value={checkoutForm.address.detail}
            />
          </label>
          <button
            className="shop-product__button"
            disabled={!cart || cart.items.length === 0 || isCheckingOut}
            type="submit"
          >
            {isCheckingOut ? "Submitting..." : "Submit order"}
          </button>
        </form>

        {order ? (
          <section className="shop-payment">
            <h3>Order payment</h3>
            <p>
              {order.orderNo} / {order.status}{order.closeReason ? ` / ${order.closeReason}` : ""}{order.memberCancelReason ? ` / ${cancelReasonLabels[order.memberCancelReason as MemberCancelReason] ?? order.memberCancelReason}` : ""} / {formatCents(order.totalCents)}
            </p>
            {order.memberDiscountCents && order.memberDiscountCents > 0 ? (
              <p>
                Member price {order.memberTier}: saved {formatCents(order.memberDiscountCents)}
              </p>
            ) : null}
            {order.discountCents && order.discountCents > 0 ? (
              <p>
                Coupon {order.couponCode} saved {formatCents(order.discountCents)} from {formatCents(order.subtotalCents ?? order.totalCents)}.
              </p>
            ) : null}
            <div className="shop-payment__providers">
              <label>
                <input
                  checked={paymentProvider === "wechat"}
                  onChange={() => setPaymentProvider("wechat")}
                  type="radio"
                />
                WeChat
              </label>
              <label>
                <input
                  checked={paymentProvider === "alipay"}
                  onChange={() => setPaymentProvider("alipay")}
                  type="radio"
                />
                Alipay
              </label>
            </div>
            <button
              className="shop-product__button shop-product__button--secondary"
              disabled={order.status === "paid" || order.status === "cancelled" || isPaying}
              onClick={() => void handleCreatePayment()}
              type="button"
            >
              {canRetryPayment ? "Create a new payment attempt" : payment ? "Use current payment attempt" : "Create payment intent"}
            </button>
            {payment ? (
              <>
                <p>
                  Payment intent {payment.id} / attempt {payment.attemptNo} / {payment.status} / {formatCents(payment.amount)}
                </p>
                <p>
                  {payment.status === "failed"
                    ? formatPaymentFailure(payment.failureCode, payment.failureMessage)
                    : payment.status === "cancelled"
                      ? "This payment intent was cancelled."
                      : payment.expiresAt
                        ? isPaymentExpired
                          ? isRefreshingExpiredPayment
                            ? "Refreshing payment status..."
                            : "Payment expired. Refreshing the order status..."
                          : `Pay before ${new Date(payment.expiresAt).toLocaleString()} (${paymentRemainingSeconds}s left)`
                        : "Payment deadline not set"}
                </p>
                {payment.previousPaymentIntentId ? (
                  <p>Previous attempt {payment.previousPaymentIntentId}</p>
                ) : null}
                <div className="shop-payment__providers">
                  <button
                    className="shop-product__button"
                    disabled={payment.status === "paid" || payment.status === "cancelled" || payment.status === "failed" || isPaymentExpired || isPaying}
                    onClick={() => void handleConfirmPayment("success")}
                    type="button"
                  >
                    {payment.status === "paid" ? "Payment complete" : "Mock success"}
                  </button>
                  <button
                    className="shop-product__button shop-product__button--secondary"
                    disabled={payment.status === "paid" || payment.status === "cancelled" || payment.status === "failed" || isPaymentExpired || isPaying}
                    onClick={() => void handleConfirmPayment("failed")}
                    type="button"
                  >
                    Mock failure
                  </button>
                </div>
                {canRetryPayment ? (
                  <button
                    className="shop-product__button shop-product__button--secondary"
                    disabled={isPaying}
                    onClick={() => void handleCreatePayment()}
                    type="button"
                  >
                    {isPaying ? "Preparing retry..." : "Retry payment"}
                  </button>
                ) : null}
              </>
            ) : null}
            {paymentAttempts.length > 0 ? (
              <div className="shop-checkout">
                <h3>Payment attempts</h3>
                {paymentAttempts.map((attempt) => (
                  <p key={attempt.paymentIntentId}>
                    Attempt {attempt.attemptNo}: {attempt.provider} / {attempt.status}
                    {attempt.failureCode
                      ? ` / ${formatPaymentFailure(attempt.failureCode, attempt.failureMessage)}`
                      : ""}
                  </p>
                ))}
              </div>
            ) : null}
            {canRestartAfterTimeout ? (
              <div className="shop-checkout">
                <h3>Payment timeout</h3>
                <p>This unpaid order was closed after the payment window ended.</p>
                <button
                  className="shop-product__button shop-product__button--secondary"
                  onClick={handleRestartCheckoutFlow}
                  type="button"
                >
                  Start a new order
                </button>
              </div>
            ) : null}
            <div className="shop-checkout">
              <h3>Order cancellation</h3>
              <label>
                Cancellation reason
                <select
                  onChange={(event) => setCancelReason(event.target.value as MemberCancelReason)}
                  value={cancelReason}
                >
                  {Object.entries(cancelReasonLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <textarea
                  onChange={(event) => setCancelNote(event.target.value)}
                  placeholder="Optional note"
                  rows={2}
                  value={cancelNote}
                />
              </label>
              <button
                className="shop-product__button shop-product__button--secondary"
                disabled={!canCancelOrder || isCancellingOrder}
                onClick={() => void handleCancelOrder()}
                type="button"
              >
                {isCancellingOrder ? "Cancelling..." : "Cancel order"}
              </button>
            </div>
            <form className="shop-checkout" onSubmit={(event) => void handleReviewSubmit(event)}>
              <h3>Submit a product review</h3>
              <label>
                Order number
                <input defaultValue={order.orderNo} name="orderNo" required />
              </label>
              <label>
                SKU
                <input defaultValue={order.items[0]?.skuCode ?? ""} name="skuCode" required />
              </label>
              <label>
                Rating
                <select defaultValue="5" name="rating">
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
              <label>
                Review body
                <textarea
                  defaultValue="Great quality and still intact after long play."
                  name="body"
                  required
                  rows={3}
                />
              </label>
              <button
                className="shop-product__button shop-product__button--secondary"
                disabled={isSubmittingReview}
                type="submit"
              >
                {isSubmittingReview ? "Submitting..." : "Submit review"}
              </button>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  );
}



