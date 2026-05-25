"use client";

import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import {
  CartResponse,
  ShopProductDetail,
  addCartItem,
  formatCents
} from "./shop-api";

interface AddToCartPanelProps {
  products: ShopProductDetail[];
}

export function AddToCartPanel({ products }: AddToCartPanelProps) {
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [busySku, setBusySku] = useState<string | null>(null);
  const [message, setMessage] = useState("选择商品加入购物车");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(product: ShopProductDetail) {
    const variant = product.variants.find((item) => item.isAvailable);

    if (!variant) {
      setError("这个商品暂时无库存");
      return;
    }

    setBusySku(variant.skuCode);
    setError(null);

    try {
      const storedCartId = cart?.cartId ?? localStorage.getItem("kzt_cart_id") ?? undefined;
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
      setMessage(`${product.title} 已加入购物车`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加入购物车失败");
    } finally {
      setBusySku(null);
    }
  }

  return (
    <div className="shop-grid">
      <section className="shop-products" aria-label="商品列表">
        {products.map((product) => {
          const variant = product.variants.find((item) => item.isAvailable);
          const isBusy = variant?.skuCode === busySku;

          return (
            <article className="shop-product" key={product.slug}>
              <div className="shop-product__imageWrap">
                <img
                  alt={product.title}
                  className="shop-product__image"
                  src={product.coverImageUrl}
                />
              </div>
              <div className="shop-product__body">
                <p className="shop-product__type">{product.petType} / {product.toyType}</p>
                <h2>{product.title}</h2>
                <p>{product.description}</p>
                <div className="shop-product__meta">
                  <strong>{formatCents(product.priceCents)}</strong>
                  <span>{variant ? `库存 ${variant.stock}` : "暂无库存"}</span>
                </div>
                <button
                  className="shop-product__button"
                  data-testid={`add-${product.slug}`}
                  disabled={!variant || isBusy}
                  onClick={() => void handleAdd(product)}
                  type="button"
                >
                  <ShoppingCart size={16} />
                  {isBusy ? "加入中" : "加入购物车"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <aside className="shop-cart" aria-live="polite">
        <div>
          <p className="shop-cart__eyebrow">Cart</p>
          <h2>购物车</h2>
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
            <span>尚未添加商品</span>
            <strong>{formatCents(0)}</strong>
          </div>
        )}
      </aside>
    </div>
  );
}
