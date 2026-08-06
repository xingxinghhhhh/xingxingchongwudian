export interface ShopProduct {
  id: string;
  slug: string;
  title: string;
  petType: "cat" | "dog" | "both";
  toyType: string;
  tags: string[];
  priceCents: number;
  coverImageUrl: string;
  status: "active" | "draft" | "archived";
}

export interface ShopProductVariant {
  id: string;
  skuCode: string;
  name: string;
  color: string;
  size: string;
  material: string;
  priceCents: number;
  compareAtCents?: number;
  stock: number;
  isAvailable: boolean;
}

export interface ShopProductDetail extends ShopProduct {
  description: string;
  images: string[];
  variants: ShopProductVariant[];
}

export type ProductSort = "default" | "price_asc" | "price_desc";

export interface ProductSearchInput {
  q?: string;
  petType?: ShopProduct["petType"];
  toyType?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: ProductSort;
}

export interface ProductSearchResponse {
  items: ShopProduct[];
  meta: {
    total: number;
    filters: Omit<ProductSearchInput, "sort">;
    sort: ProductSort;
    availablePetTypes: ShopProduct["petType"][];
    availableToyTypes: string[];
    availableTags?: string[];
    priceRange: {
      minCents: number;
      maxCents: number;
    };
    recommendedItems?: ShopProduct[];
    recommendationReason?: string;
  };
}

export type ShipmentStatus =
  | "created"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception";

export interface ShipmentEvent {
  status: ShipmentStatus;
  location: string;
  description: string;
  happenedAt: string;
}

export interface ShipmentRecord {
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippedAt: string;
  deliveredAt?: string;
  events: ShipmentEvent[];
}

export type ProductReviewStatus = "pending_review" | "visible" | "hidden";

export interface ProductReview {
  reviewNo: string;
  orderNo: string;
  productSlug: string;
  skuCode: string;
  rating: number;
  body: string;
  images: string[];
  authorName: string;
  status: ProductReviewStatus;
  createdAt: string;
}

export interface ProductReviewsResponse {
  summary: {
    averageRating: number;
    reviewCount: number;
  };
  items: ProductReview[];
}

export interface CreateProductReviewInput {
  orderNo: string;
  skuCode: string;
  rating: number;
  body: string;
  authorName?: string;
  images?: string[];
}

export interface CartItem {
  skuCode: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface CartResponse {
  cartId: string;
  items: CartItem[];
  subtotalCents: number;
}

export interface AddCartItemInput {
  skuCode: string;
  quantity: number;
  cartId?: string;
}

export interface CheckoutCartInput {
  couponCode?: string;
  couponCodes?: string[];
  customer: {
    name: string;
    phone: string;
  };
  address: {
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    detail: string;
  };
}

export interface OrderResponse {
  orderNo: string;
  status:
    | "pending_payment"
    | "paid"
    | "refunding"
    | "shipped"
    | "completed"
    | "cancelled"
    | "refunded";
  totalCents: number;
  closedAt?: string;
  closeReason?: string;
  memberCancelReason?: string;
  memberCancelNote?: string;
  inventoryReleasedAt?: string;
  subtotalCents?: number;
  memberTier?: "bronze" | "silver" | "gold";
  memberDiscountCents?: number;
  discountCents?: number;
  couponCode?: string;
  items: Array<{
    skuCode: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  shipment?: ShipmentRecord;
}

export interface OrderTrackingResponse {
  orderNo: string;
  orderStatus: OrderResponse["status"];
  currentStatus?: ShipmentStatus;
  shipment?: Omit<ShipmentRecord, "events">;
  events: ShipmentEvent[];
}

export type PaymentProvider = "wechat" | "alipay";
export type PaymentIntentProvider = "mock_wechat" | "mock_alipay";
export type PaymentFailureCode =
  | "INSUFFICIENT_BALANCE"
  | "PAYMENT_DECLINED"
  | "PROVIDER_UNAVAILABLE"
  | "USER_CANCELLED_PAYMENT"
  | "UNKNOWN_PROVIDER_ERROR";
export type PaymentIntentStatus =
  | "created"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

export interface CreatePaymentIntentInput {
  orderId: string;
  provider: PaymentIntentProvider;
  sessionToken: string;
}

export interface PaymentIntentResponse {
  id: string;
  orderId: string;
  memberId: string;
  amount: number;
  currency: "CNY";
  provider: PaymentIntentProvider;
  status: PaymentIntentStatus;
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
  failureCode?: PaymentFailureCode;
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

export interface OrderPaymentAttemptResponse {
  paymentIntentId: string;
  attemptNo: number;
  provider: PaymentIntentProvider;
  status: PaymentIntentStatus;
  failureCode?: PaymentFailureCode;
  failureMessage?: string;
  createdAt: string;
  failedAt?: string;
  paidAt?: string;
}

export interface OrderPaymentAttemptsResponse {
  orderId: string;
  attempts: OrderPaymentAttemptResponse[];
}
export interface ConfirmPaymentIntentInput {
  paymentIntentId: string;
  sessionToken: string;
  result?: "success" | "failed";
}

export interface ConfirmPaymentIntentResponse {
  paymentIntent: PaymentIntentResponse;
  orderStatus: OrderResponse["status"];
}

export type MemberCancelReason =
  | "ORDER_CREATED_BY_MISTAKE"
  | "CHANGED_MIND"
  | "WRONG_PRODUCT"
  | "WRONG_ADDRESS"
  | "FOUND_BETTER_OPTION"
  | "OTHER";

export interface CancelOrderInput {
  orderId: string;
  reason: MemberCancelReason;
  note?: string;
  sessionToken: string;
}

export interface CancelOrderResponse {
  orderId: string;
  orderStatus: OrderResponse["status"];
  closeReason?: string;
  memberCancelReason?: string;
  memberCancelNote?: string;
  closedAt?: string;
  inventoryReleased: boolean;
  paymentIntent?: {
    id: string;
    status: PaymentIntentStatus;
    cancelledAt?: string;
  };
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export async function listProducts(fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: ShopProduct[] }>(
    "/products",
    { cache: "no-store" },
    fetcher
  );

  return response.items;
}

export function searchProducts(
  input: ProductSearchInput = {},
  fetcher: Fetcher = fetch
) {
  return requestJson<ProductSearchResponse>(
    `/products${toProductSearchQuery(input)}`,
    { cache: "no-store" },
    fetcher
  );
}

export async function getProductDetail(slug: string, fetcher: Fetcher = fetch) {
  return requestJson<ShopProductDetail>(
    `/products/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
    fetcher
  );
}

export async function addCartItem(
  input: AddCartItemInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CartResponse>(
    "/cart/items",
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
}

export function checkoutCart(
  cartId: string,
  input: CheckoutCartInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<OrderResponse>(
    `/cart/${encodeURIComponent(cartId)}/checkout`,
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
}

export function getOrder(orderNo: string, fetcher: Fetcher = fetch) {
  return requestJson<OrderResponse>(
    `/orders/${encodeURIComponent(orderNo)}`,
    { cache: "no-store" },
    fetcher
  );
}

export function cancelOrder(
  input: CancelOrderInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CancelOrderResponse>(
    `/orders/${encodeURIComponent(input.orderId)}/cancel`,
    {
      body: JSON.stringify({
        note: input.note,
        reason: input.reason
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Member-Token": input.sessionToken
      },
      method: "POST"
    },
    fetcher
  );
}

export function getOrderPaymentAttempts(
  orderId: string,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<OrderPaymentAttemptsResponse>(
    `/orders/${encodeURIComponent(orderId)}/payment-attempts`,
    {
      cache: "no-store",
      headers: {
        "X-Member-Token": sessionToken
      }
    },
    fetcher
  );
}
export function createPaymentIntent(
  input: CreatePaymentIntentInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<PaymentIntentResponse>(
    "/payments/intents",
    {
      body: JSON.stringify({
        orderId: input.orderId,
        provider: input.provider
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Member-Token": input.sessionToken
      },
      method: "POST"
    },
    fetcher
  );
}

export function getPaymentIntent(
  paymentIntentId: string,
  sessionToken: string,
  fetcher: Fetcher = fetch
) {
  return requestJson<PaymentIntentResponse>(
    `/payments/${encodeURIComponent(paymentIntentId)}`,
    {
      cache: "no-store",
      headers: {
        "X-Member-Token": sessionToken
      }
    },
    fetcher
  );
}

export function confirmPaymentIntent(
  input: ConfirmPaymentIntentInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<ConfirmPaymentIntentResponse>(
    `/payments/${encodeURIComponent(input.paymentIntentId)}/confirm`,
    {
      body: JSON.stringify({
        result: input.result
      }),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Member-Token": input.sessionToken
      },
      method: "POST"
    },
    fetcher
  );
}

export function getOrderTracking(orderNo: string, fetcher: Fetcher = fetch) {
  return requestJson<OrderTrackingResponse>(
    `/orders/${encodeURIComponent(orderNo)}/tracking`,
    { cache: "no-store" },
    fetcher
  );
}

export function listProductReviews(slug: string, fetcher: Fetcher = fetch) {
  return requestJson<ProductReviewsResponse>(
    `/products/${encodeURIComponent(slug)}/reviews`,
    { cache: "no-store" },
    fetcher
  );
}

export function createProductReview(
  input: CreateProductReviewInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<ProductReview>(
    "/reviews",
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
}

export function formatCents(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    currency: "CNY",
    style: "currency"
  }).format(value / 100);
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

  return "请求失败";
}

function toProductSearchQuery(input: ProductSearchInput) {
  const params = new URLSearchParams();

  appendQueryParam(params, "q", input.q);
  appendQueryParam(params, "petType", input.petType);
  appendQueryParam(params, "toyType", input.toyType);
  appendQueryParam(params, "minPriceCents", input.minPriceCents);
  appendQueryParam(params, "maxPriceCents", input.maxPriceCents);
  appendQueryParam(params, "sort", input.sort);

  const query = params.toString();
  return query ? `?${query}` : "";
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined
) {
  if (value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

