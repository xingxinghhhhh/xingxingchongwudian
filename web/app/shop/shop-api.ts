export interface ShopProduct {
  id: string;
  slug: string;
  title: string;
  petType: "cat" | "dog" | "both";
  toyType: string;
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

  return "Request failed";
}
