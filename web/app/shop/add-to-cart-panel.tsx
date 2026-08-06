"use client";

import { ShoppingCart } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  cancelOrder,
  CartResponse,
  CheckoutCartInput,
  MemberCancelReason,
  OrderPaymentAttemptResponse,
  OrderResponse,
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
import {
  getPaymentProviderLabel,
  getPaymentStatusLabel,
  getMemberCancelReasonLabel,
  getPaymentFailureLabel,
  getPetTypeLabel,
  getProductDescriptionLabel,
  getProductTagLabel,
  getProductTitleLabel,
  getToyTypeLabel,
  listMemberCancelReasonLabels
} from "./shop-copy";
interface AddToCartPanelProps {
  products: ShopProductDetail[];
}

const defaultCheckoutForm: CheckoutCartInput = {
  couponCode: "WELCOME20",
  customer: {
    name: "会员伙伴",
    phone: "13800138000"
  },
  address: {
    receiverName: "会员伙伴",
    phone: "13800138000",
    province: "广东省",
    city: "深圳市",
    district: "南山区",
    detail: "云养宠街 1 号"
  }
};

const defaultCancelReason: MemberCancelReason = "ORDER_CREATED_BY_MISTAKE";

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
  const [message, setMessage] = useState("选择商品后开始结算。");
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
            `订单 ${nextOrder.orderNo} 的支付已过期，库存已释放。`
          );
        }
      } catch {
        if (active) {
          setError("刷新过期支付状态失败。");
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

    throw new Error("请先前往会员中心完成短信验证后再支付");
  }

  async function refreshPaymentAttempts(orderNo: string, sessionToken: string) {
    const attempts = await getOrderPaymentAttempts(orderNo, sessionToken);
    setPaymentAttempts(attempts.attempts);
    return attempts.attempts;
  }
  async function handleAdd(product: ShopProductDetail) {
    const variant = product.variants.find((item) => item.isAvailable);

    if (!variant) {
      setError("该商品当前缺货。");
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
      setMessage(`${getProductTitleLabel(product.title)} 已加入购物车。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加入购物车失败。");
    } finally {
      setBusySku(null);
    }
  }

  async function handleCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!cart || cart.items.length === 0) {
      setError("请先加入至少一件商品再结算。");
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
      setMessage(`订单 ${nextOrder.orderNo} 已创建，请选择支付方式。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "结算失败。");
    } finally {
      setIsCheckingOut(false);
    }
  }

  async function handleCreatePayment() {
    if (!order) {
      setError("请先创建订单再支付。");
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
          ? `第 ${nextPayment.attemptNo} 次支付尝试已创建。`
          : `${paymentProvider === "wechat" ? "微信" : "支付宝"} 支付单已创建。`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建支付单失败。");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleConfirmPayment(result: "success" | "failed") {
    if (!payment) {
      setError("请先创建支付单。");
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
          ? `订单 ${nextOrder.orderNo} 支付成功。`
          : nextPayment.status === "expired"
            ? `订单 ${nextOrder.orderNo} 的支付已过期。`
            : getPaymentFailureLabel(nextPayment.failureCode, nextPayment.failureMessage)
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "支付确认失败。");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleCancelOrder() {
    if (!order) {
      setError("请先创建订单再取消。");
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
          ? `订单 ${order.orderNo} 已取消，库存已释放。`
          : `订单 ${order.orderNo} 已取消。`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "取消订单失败。");
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
    setMessage("重新加入商品即可开启新订单。");
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

      setMessage("评价已提交，审核通过后会公开展示。");
      event.currentTarget.reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "评价提交失败。");
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
      <section className="shop-products" aria-label="商品列表">
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
                  {getPetTypeLabel(product.petType)} / {getToyTypeLabel(product.toyType)}
                </p>
                {(product.tags ?? []).length > 0 ? (
                  <div className="shop-product__tags" aria-label="商品标签">
                    {product.tags.slice(0, 4).map((tag) => (
                      <span key={tag}>{getProductTagLabel(tag)}</span>
                    ))}
                  </div>
                ) : null}
                <h2>{getProductTitleLabel(product.title)}</h2>
                <p>{getProductDescriptionLabel(product.description)}</p>
                <div className="shop-product__meta">
                  <strong>{formatCents(product.priceCents)}</strong>
                  <span>{variant ? `库存 ${variant.stock}` : "暂无可售规格"}</span>
                </div>
                <button
                  className="shop-product__button"
                  data-testid={`add-${product.slug}`}
                  disabled={!variant || isBusy}
                  onClick={() => void handleAdd(product)}
                  type="button"
                >
                  <ShoppingCart size={16} />
                  {isBusy ? "加入中..." : "加入购物车"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <aside className="shop-cart" aria-live="polite">
        <div>
          <p className="shop-cart__eyebrow">购物车</p>
          <h2>结算</h2>
        </div>
        <p className={error ? "shop-cart__error" : "shop-cart__message"}>
          {error ?? message}
        </p>
        {cart ? (
          <div className="shop-cart__summary">
            <span>{cart.items.length} 件商品</span>
            <strong>{formatCents(cart.subtotalCents)}</strong>
          </div>
        ) : (
          <div className="shop-cart__summary shop-cart__summary--empty">
            <span>购物车为空</span>
            <strong>{formatCents(0)}</strong>
          </div>
        )}

        <form className="shop-checkout" onSubmit={(event) => void handleCheckout(event)}>
          <h3>收货与优惠</h3>
          <label>
            优惠券码
            <input
              onChange={(event) => updateCouponCode(event.target.value)}
              placeholder="WELCOME20"
              value={checkoutForm.couponCode ?? ""}
            />
          </label>
          <label>
            客户姓名
            <input
              onChange={(event) => updateCustomer("name", event.target.value)}
              required
              value={checkoutForm.customer.name}
            />
          </label>
          <label>
            客户手机号
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
            收货人
            <input
              onChange={(event) => updateAddress("receiverName", event.target.value)}
              required
              value={checkoutForm.address.receiverName}
            />
          </label>
          <div className="shop-checkout__region">
            <label>
              省份
              <input
                onChange={(event) => updateAddress("province", event.target.value)}
                required
                value={checkoutForm.address.province}
              />
            </label>
            <label>
              城市
              <input
                onChange={(event) => updateAddress("city", event.target.value)}
                required
                value={checkoutForm.address.city}
              />
            </label>
            <label>
              区县
              <input
                onChange={(event) => updateAddress("district", event.target.value)}
                required
                value={checkoutForm.address.district}
              />
            </label>
          </div>
          <label>
            详细地址
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
            {isCheckingOut ? "结算中..." : "提交订单"}
          </button>
        </form>

        {order ? (
          <section className="shop-payment">
            <h3>模拟支付</h3>
            <p>
              {order.orderNo} / {getPaymentStatusLabel(order.status)}{order.closeReason ? ` / ${order.closeReason}` : ""}{order.memberCancelReason ? ` / ${getMemberCancelReasonLabel(order.memberCancelReason)}` : ""} / {formatCents(order.totalCents)}
            </p>
            {order.memberDiscountCents && order.memberDiscountCents > 0 ? (
              <p>
                会员价 {order.memberTier}：已节省 {formatCents(order.memberDiscountCents)}
              </p>
            ) : null}
            {order.discountCents && order.discountCents > 0 ? (
              <p>
                优惠券 {order.couponCode} 已优惠 {formatCents(order.discountCents)}，原小计 {formatCents(order.subtotalCents ?? order.totalCents)}。
              </p>
            ) : null}
            <div className="shop-payment__providers">
              <label>
                <input
                  checked={paymentProvider === "wechat"}
                  onChange={() => setPaymentProvider("wechat")}
                  type="radio"
                />
                微信
              </label>
              <label>
                <input
                  checked={paymentProvider === "alipay"}
                  onChange={() => setPaymentProvider("alipay")}
                  type="radio"
                />
                支付宝
              </label>
            </div>
            <button
              className="shop-product__button shop-product__button--secondary"
              disabled={order.status === "paid" || order.status === "cancelled" || isPaying}
              onClick={() => void handleCreatePayment()}
              type="button"
            >
              {canRetryPayment ? "重新创建支付单" : payment ? "刷新支付单" : "创建支付单"}
            </button>
            {payment ? (
              <>
                <p>
                  支付单 {payment.id} / 第 {payment.attemptNo} 次 / {getPaymentStatusLabel(payment.status)} / {formatCents(payment.amount)}
                </p>
                <p>
                  {payment.status === "failed"
                    ? getPaymentFailureLabel(payment.failureCode, payment.failureMessage)
                    : payment.status === "cancelled"
                      ? "支付已取消"
                      : payment.expiresAt
                        ? isPaymentExpired
                          ? isRefreshingExpiredPayment
                            ? "正在刷新过期状态..."
                            : "支付已过期，正在同步订单状态..."
                          : `将于 ${new Date(payment.expiresAt).toLocaleString()} 过期，剩余 ${paymentRemainingSeconds} 秒`
                        : "等待支付确认"}
                </p>
                {payment.previousPaymentIntentId ? (
                  <p>上一次支付尝试 {payment.previousPaymentIntentId}</p>
                ) : null}
                <div className="shop-payment__providers">
                  <button
                    className="shop-product__button"
                    disabled={payment.status === "paid" || payment.status === "cancelled" || payment.status === "failed" || isPaymentExpired || isPaying}
                    onClick={() => void handleConfirmPayment("success")}
                    type="button"
                  >
                    {payment.status === "paid" ? "已支付" : "模拟支付成功"}
                  </button>
                  <button
                    className="shop-product__button shop-product__button--secondary"
                    disabled={payment.status === "paid" || payment.status === "cancelled" || payment.status === "failed" || isPaymentExpired || isPaying}
                    onClick={() => void handleConfirmPayment("failed")}
                    type="button"
                  >
                    模拟支付失败
                  </button>
                </div>
                {canRetryPayment ? (
                  <button
                    className="shop-product__button shop-product__button--secondary"
                    disabled={isPaying}
                    onClick={() => void handleCreatePayment()}
                    type="button"
                  >
                    {isPaying ? "重新创建中..." : "重试支付"}
                  </button>
                ) : null}
              </>
            ) : null}
            {paymentAttempts.length > 0 ? (
              <div className="shop-checkout">
                <h3>支付尝试记录</h3>
                {paymentAttempts.map((attempt) => (
                  <p key={attempt.paymentIntentId}>
                    第 {attempt.attemptNo} 次：{getPaymentProviderLabel(attempt.provider)} / {getPaymentStatusLabel(attempt.status)}
                    {attempt.failureCode
                      ? ` / ${getPaymentFailureLabel(attempt.failureCode, attempt.failureMessage)}`
                      : ""}
                  </p>
                ))}
              </div>
            ) : null}
            {canRestartAfterTimeout ? (
              <div className="shop-checkout">
                <h3>支付超时</h3>
                <p>订单已关闭，库存已释放，可重新下单。</p>
                <button
                  className="shop-product__button shop-product__button--secondary"
                  onClick={handleRestartCheckoutFlow}
                  type="button"
                >
                  重新下单
                </button>
              </div>
            ) : null}
            <div className="shop-checkout">
              <h3>取消订单</h3>
              <label>
                取消原因
                <select
                  onChange={(event) => setCancelReason(event.target.value as MemberCancelReason)}
                  value={cancelReason}
                >
                  {listMemberCancelReasonLabels().map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                备注
                <textarea
                  onChange={(event) => setCancelNote(event.target.value)}
                  placeholder="可填写补充说明"
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
                {isCancellingOrder ? "取消中..." : "取消订单"}
              </button>
            </div>
            <form className="shop-checkout" onSubmit={(event) => void handleReviewSubmit(event)}>
              <h3>订单评价</h3>
              <label>
                订单号
                <input defaultValue={order.orderNo} name="orderNo" required />
              </label>
              <label>
                商品规格编号
                <input defaultValue={order.items[0]?.skuCode ?? ""} name="skuCode" required />
              </label>
              <label>
                评分
                <select defaultValue="5" name="rating">
                  <option value="5">5</option>
                  <option value="4">4</option>
                  <option value="3">3</option>
                  <option value="2">2</option>
                  <option value="1">1</option>
                </select>
              </label>
              <label>
                评价内容
                <textarea
                  defaultValue="这件玩具很适合我的宠物。"
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
                {isSubmittingReview ? "提交中..." : "提交评价"}
              </button>
            </form>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
