import { SiteHeader } from "../components/site-header";
import { AddToCartPanel } from "./add-to-cart-panel";
import type { ShopProductDetail } from "./shop-api";
import { getProductDetail, listProducts } from "./shop-api";

export default async function ShopPage() {
  let products: ShopProductDetail[] = [];
  let loadError: string | null = null;

  try {
    const listItems = await listProducts();
    products = await Promise.all(
      listItems.map((product) => getProductDetail(product.slug))
    );
  } catch (caught) {
    loadError = caught instanceof Error ? caught.message : "商品接口暂时不可用";
  }

  return (
    <main className="shop-page">
      <SiteHeader />

      <section className="shop-hero">
        <div className="shop-hero__inner">
          <p className="section__kicker">Shop</p>
          <h1>宠物玩具商城</h1>
          <p>
            给每日陪伴挑一件耐玩的小东西，从咬绳到逗猫棒，先把最常用的选择放在眼前。
          </p>
        </div>
      </section>

      <section className="shop-section">
        {loadError ? (
          <div className="shop-error" role="alert">
            <h2>商品暂时加载失败</h2>
            <p>{loadError}</p>
          </div>
        ) : (
          <AddToCartPanel products={products} />
        )}
      </section>
    </main>
  );
}
