"use client";

import {
  CreditCard,
  Heart,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  petType: "cat" | "dog" | "both";
  toyType: string;
  priceCents: number;
  coverImageUrl: string;
  status: string;
  variants?: Variant[];
};

type Variant = {
  skuCode: string;
  name: string;
  priceCents: number;
  stock: number;
  isAvailable: boolean;
};

type CartItem = {
  skuCode: string;
  title: string;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
};

type Cart = {
  cartId: string;
  items: CartItem[];
  subtotalCents: number;
};

type Order = {
  orderNo: string;
  status: string;
  totalCents: number;
  items: Array<{
    skuCode: string;
    title: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};

type Payment = {
  paymentNo: string;
  orderNo: string;
  provider: "wechat" | "alipay";
  channel: string;
  amountCents: number;
  status: string;
  payUrl: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN ?? "dev-admin-key";

const productImages: Record<string, string> = {
  "durable-bite-rope":
    "https://images.unsplash.com/photo-1601758124510-52d02ddb7cbd?auto=format&fit=crop&w=900&q=80",
  "cat-teaser-wand":
    "https://images.unsplash.com/photo-1545249390-6bdfa286032f?auto=format&fit=crop&w=900&q=80"
};

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message ?? "请求失败");
  }

  return payload as T;
}

const defaultCheckout = {
  customer: {
    name: "星星",
    phone: "13800138000"
  },
  address: {
    receiverName: "星星",
    phone: "13800138000",
    province: "Guangdong",
    city: "Shenzhen",
    district: "Nanshan",
    detail: "Science Park 1"
  }
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("正在连接后端 API...");

  useEffect(() => {
    void loadProducts();
  }, []);

  const cartCount = useMemo(
    () => cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0,
    [cart]
  );

  async function loadProducts() {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Product[] }>("/products");
      const details = await Promise.all(
        data.items.map((product) =>
          apiFetch<Product>(`/products/${product.slug}`)
        )
      );
      setProducts(details);
      setSelectedProduct(details[0] ?? null);
      setMessage("后端已连接，商城数据来自 NestJS API。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "商品加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function addToCart(product: Product) {
    const skuCode = product.variants?.[0]?.skuCode;
    if (!skuCode) {
      setMessage("这个商品还没有可售 SKU。");
      return;
    }

    setLoading(true);
    try {
      const nextCart = await apiFetch<Cart>("/cart/items", {
        method: "POST",
        body: JSON.stringify({
          cartId: cart?.cartId,
          skuCode,
          quantity: 1
        })
      });
      setCart(nextCart);
      setMessage(`${product.title} 已加入购物车。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加入购物车失败");
    } finally {
      setLoading(false);
    }
  }

  async function updateCartItem(item: CartItem, quantity: number) {
    if (!cart) return;
    setLoading(true);
    try {
      const nextCart = await apiFetch<Cart>(`/cart/items/${item.skuCode}`, {
        method: "PATCH",
        body: JSON.stringify({
          cartId: cart.cartId,
          quantity
        })
      });
      setCart(nextCart);
      setMessage("购物车已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新购物车失败");
    } finally {
      setLoading(false);
    }
  }

  async function checkoutCart() {
    if (!cart) {
      setMessage("请先加入购物车。");
      return;
    }
    setLoading(true);
    try {
      const created = await apiFetch<Order>(`/cart/${cart.cartId}/checkout`, {
        method: "POST",
        body: JSON.stringify(defaultCheckout)
      });
      const cleared = await apiFetch<Cart>(`/cart/${cart.cartId}`);
      setOrder(created);
      setCart(cleared);
      setPayment(null);
      setMessage(`订单 ${created.orderNo} 已创建，等待支付。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "结算失败");
    } finally {
      setLoading(false);
    }
  }

  async function createPayment(provider: "wechat" | "alipay") {
    if (!order) {
      setMessage("请先创建订单。");
      return;
    }
    setLoading(true);
    try {
      const created = await apiFetch<Payment>(`/payments/${provider}`, {
        method: "POST",
        body: JSON.stringify({
          orderNo: order.orderNo,
          channel: "h5"
        })
      });
      setPayment(created);
      setMessage(
        `${provider === "wechat" ? "微信" : "支付宝"}支付单已创建。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建支付单失败");
    } finally {
      setLoading(false);
    }
  }

  async function mockPay() {
    if (!payment) return;
    setLoading(true);
    try {
      await apiFetch(`/payments/${payment.provider}/notify`, {
        method: "POST",
        body: JSON.stringify({
          paymentNo: payment.paymentNo,
          providerTradeNo: `${payment.provider}_trade_demo`,
          paidAmountCents: payment.amountCents
        })
      });
      const paidOrder = await apiFetch<Order>(`/orders/${payment.orderNo}`);
      setOrder(paidOrder);
      setPayment({ ...payment, status: "paid" });
      setMessage("支付回调已模拟完成，订单状态已变为 paid。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模拟支付失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminOrders() {
    setLoading(true);
    try {
      const data = await apiFetch<{ items: Order[] }>("/admin/orders", {
        headers: {
          "X-Admin-Token": ADMIN_TOKEN
        }
      });
      setAdminOrders(data.items.slice().reverse());
      setMessage("后台订单已刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "后台订单加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function shipOrder(orderNo: string) {
    setLoading(true);
    try {
      await apiFetch(`/admin/orders/${orderNo}/status`, {
        method: "PATCH",
        headers: {
          "X-Admin-Token": ADMIN_TOKEN
        },
        body: JSON.stringify({
          status: "shipped"
        })
      });
      await loadAdminOrders();
      if (order?.orderNo === orderNo) {
        setOrder(await apiFetch<Order>(`/orders/${orderNo}`));
      }
      setMessage(`订单 ${orderNo} 已标记发货。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订单发货失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <div className="page">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={22} />
            </div>
            <span>星星宠物店</span>
          </div>
          <nav className="nav" aria-label="页面导航">
            <button onClick={() => document.getElementById("shop")?.scrollIntoView()}>
              商品
            </button>
            <button onClick={() => document.getElementById("checkout")?.scrollIntoView()}>
              结算
            </button>
            <button onClick={() => document.getElementById("admin")?.scrollIntoView()}>
              后台
            </button>
            <span className="pill">
              <ShoppingCart size={16} /> {cartCount}
            </span>
          </nav>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">从内容种草到独立站成交</p>
            <h1>让猫狗每天都多一点好玩的期待。</h1>
            <p className="lead">
              一个面向国内用户的宠物玩具独立站 MVP：商品、购物车、结算、支付模拟和后台订单已经接上后端 API。
            </p>
            <div className="hero-actions">
              <button
                className="primary"
                onClick={() => document.getElementById("shop")?.scrollIntoView()}
              >
                <ShoppingCart size={18} />
                选购玩具
              </button>
              <button className="secondary" onClick={loadProducts}>
                <RefreshCw size={18} />
                刷新商品
              </button>
            </div>
          </div>
          <aside className="hero-panel">
            <img
              alt="宠物玩具使用场景"
              src="https://images.unsplash.com/photo-1596492784531-6e6eb5ea9993?auto=format&fit=crop&w=1000&q=80"
            />
            <div className="hero-panel-caption">
              <div>
                <strong>内容平台落地页就绪</strong>
                <p className="muted">适合抖音、小红书、微博视频挂链测试。</p>
              </div>
              <span className="status">{loading ? "同步中" : "MVP"}</span>
            </div>
          </aside>
        </section>

        <div className="notice">{message}</div>

        <section id="shop" className="section">
          <div className="section-head">
            <div>
              <h2>主推玩具</h2>
              <p>商品和 SKU 来自后端 `/api/products`。</p>
            </div>
            <span className="pill">
              <ShieldCheck size={16} /> 材质安全 · 可清洗 · 适合日常互动
            </span>
          </div>

          <div className="grid">
            {products.map((product) => (
              <article className="card" key={product.id}>
                <img
                  className="product-image"
                  alt={product.title}
                  src={productImages[product.slug] ?? product.coverImageUrl}
                />
                <div className="card-body">
                  <div className="card-title">
                    <div>
                      <strong>{product.title}</strong>
                      <p className="muted">{product.description}</p>
                    </div>
                    <span className="price">{yuan(product.priceCents)}</span>
                  </div>
                  <div className="tag-row">
                    <span className="tag">{product.petType}</span>
                    <span className="tag">{product.toyType}</span>
                    <span className="tag">
                      库存 {product.variants?.[0]?.stock ?? 0}
                    </span>
                  </div>
                  <div className="hero-actions">
                    <button
                      className="secondary"
                      onClick={() => setSelectedProduct(product)}
                    >
                      查看详情
                    </button>
                    <button className="primary" onClick={() => addToCart(product)}>
                      加入购物车
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="checkout" className="section workspace">
          <div className="stack">
            <div className="panel">
              <div className="section-head">
                <div>
                  <h2>商品详情</h2>
                  <p>{selectedProduct?.description ?? "请选择一个商品。"}</p>
                </div>
                <Heart color="#df654d" />
              </div>
              {selectedProduct ? (
                <div className="stack">
                  <div className="tag-row">
                    {selectedProduct.variants?.map((variant) => (
                      <span className="tag" key={variant.skuCode}>
                        {variant.name} · {yuan(variant.priceCents)} · 库存
                        {variant.stock}
                      </span>
                    ))}
                  </div>
                  <button
                    className="primary"
                    onClick={() => addToCart(selectedProduct)}
                  >
                    <ShoppingCart size={18} />
                    加入购物车
                  </button>
                </div>
              ) : null}
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <h2>结算信息</h2>
                  <p>使用演示收货信息直接生成待支付订单。</p>
                </div>
                <Truck />
              </div>
              <div className="input-grid">
                <div className="field">
                  <label>收货人</label>
                  <input readOnly value={defaultCheckout.customer.name} />
                </div>
                <div className="field">
                  <label>手机号</label>
                  <input readOnly value={defaultCheckout.customer.phone} />
                </div>
                <div className="field full">
                  <label>地址</label>
                  <input
                    readOnly
                    value={`${defaultCheckout.address.province} ${defaultCheckout.address.city} ${defaultCheckout.address.district} ${defaultCheckout.address.detail}`}
                  />
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="section-head">
                <div>
                  <h2>支付模拟</h2>
                  <p>支付单和回调来自后端 `/api/payments`。</p>
                </div>
                <CreditCard />
              </div>
              {order ? (
                <div className="stack">
                  <div className="order-row">
                    <div>
                      <strong>{order.orderNo}</strong>
                      <p className="muted">
                        {yuan(order.totalCents)} · {order.items.length} 件商品
                      </p>
                    </div>
                    <span className="status">{order.status}</span>
                  </div>
                  <div className="hero-actions">
                    <button className="secondary" onClick={() => createPayment("wechat")}>
                      微信 H5
                    </button>
                    <button className="secondary" onClick={() => createPayment("alipay")}>
                      支付宝 H5
                    </button>
                    <button className="primary" disabled={!payment} onClick={mockPay}>
                      模拟支付成功
                    </button>
                  </div>
                  {payment ? (
                    <p className="muted">
                      支付单：{payment.paymentNo} · {payment.status} ·{" "}
                      {payment.payUrl}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="muted">请先从购物车结算生成订单。</p>
              )}
            </div>
          </div>

          <aside className="panel">
            <div className="section-head">
              <div>
                <h2>购物车</h2>
                <p>{cart?.cartId ?? "还没有购物车"}</p>
              </div>
              <ShoppingCart />
            </div>
            <div className="stack">
              {cart?.items.length ? (
                cart.items.map((item) => (
                  <div className="cart-item" key={item.skuCode}>
                    <div>
                      <strong>{item.title}</strong>
                      <p className="muted">
                        {item.skuCode} · {yuan(item.unitPriceCents)}
                      </p>
                    </div>
                    <div className="stack">
                      <select
                        value={item.quantity}
                        onChange={(event) =>
                          updateCartItem(item, Number(event.target.value))
                        }
                      >
                        {[1, 2, 3, 4, 5].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <strong>{yuan(item.lineTotalCents)}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">加入商品后会出现在这里。</p>
              )}
              <div className="cart-item">
                <strong>小计</strong>
                <span className="price">{yuan(cart?.subtotalCents ?? 0)}</span>
              </div>
              <button className="danger" disabled={!cart?.items.length} onClick={checkoutCart}>
                <PackageCheck size={18} />
                结算成订单
              </button>
            </div>
          </aside>
        </section>

        <section id="admin" className="section panel">
          <div className="admin-bar">
            <div>
              <h2>后台订单</h2>
              <p className="muted">
                使用 `X-Admin-Token` 调用后台接口，当前演示 token 为
                dev-admin-key。
              </p>
            </div>
            <button className="secondary" onClick={loadAdminOrders}>
              <RefreshCw size={18} />
              刷新订单
            </button>
          </div>
          <div className="stack">
            {adminOrders.length ? (
              adminOrders.map((item) => (
                <div className="order-row" key={item.orderNo}>
                  <div>
                    <strong>{item.orderNo}</strong>
                    <p className="muted">
                      {yuan(item.totalCents)} · {item.items.length} 件商品
                    </p>
                  </div>
                  <div className="hero-actions">
                    <span className="status">{item.status}</span>
                    <button className="secondary" onClick={() => shipOrder(item.orderNo)}>
                      标记发货
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">点击刷新订单，查看后台管理接口效果。</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
