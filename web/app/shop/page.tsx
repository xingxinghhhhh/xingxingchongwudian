import { SiteHeader } from "../components/site-header";
import { AddToCartPanel } from "./add-to-cart-panel";
import type {
  ProductSearchInput,
  ProductSearchResponse,
  ProductSort,
  ShopProduct,
  ShopProductDetail
} from "./shop-api";
import { formatCents, getProductDetail, searchProducts } from "./shop-api";
import { getToyTypeLabel } from "./shop-copy";

type ShopPageProps = {
  searchParams?: Promise<{
    q?: string;
    petType?: ShopProduct["petType"];
    toyType?: string;
    minPriceCents?: string;
    maxPriceCents?: string;
    sort?: ProductSort;
  }>;
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const filters = toProductSearchInput(resolvedSearchParams);
  let catalog: ProductSearchResponse | null = null;
  let products: ShopProductDetail[] = [];
  let recommendedProducts: ShopProductDetail[] = [];
  let loadError: string | null = null;

  try {
    catalog = await searchProducts(filters);
    products = await Promise.all(
      catalog.items.map((product) => getProductDetail(product.slug))
    );
    recommendedProducts =
      products.length === 0
        ? await Promise.all(
            (catalog.meta.recommendedItems ?? []).map((product) =>
              getProductDetail(product.slug)
            )
          )
        : [];
  } catch (caught) {
    loadError =
      caught instanceof Error ? caught.message : "商城数据加载失败";
  }

  return (
    <main className="shop-page">
      <SiteHeader />

      <section className="shop-hero">
        <div className="shop-hero__inner">
          <p className="section__kicker">商城</p>
          <h1>宠物商城</h1>
          <p>
            搜索适合宠物的玩具，加入购物车后可下单、模拟支付，
            并在订单完成后提交评价。
          </p>
        </div>
      </section>

      <section className="shop-section">
        {loadError ? (
          <div className="shop-error" role="alert">
            <h2>商城暂时不可用</h2>
            <p>{loadError}</p>
          </div>
        ) : (
          <>
            <ProductDiscoveryForm catalog={catalog} filters={filters} />
            {products.length === 0 ? (
              <div className="shop-empty">
                <p className="shop-product__type">没有匹配结果</p>
                <h2>没有找到完全匹配的商品</h2>
                <p>
                  {catalog?.meta.recommendationReason ??
                    "可以放宽筛选条件，或先看看系统推荐的备选商品。"}
                </p>
                {recommendedProducts.length > 0 ? (
                  <div className="shop-empty__actions">
                    <span>{recommendedProducts.length} 件有库存的推荐商品已展示在下方。</span>
                    <a href="/shop">清空筛选</a>
                  </div>
                ) : null}
              </div>
            ) : null}
            <AddToCartPanel
              products={products.length > 0 ? products : recommendedProducts}
            />
          </>
        )}
      </section>
    </main>
  );
}

function ProductDiscoveryForm({
  catalog,
  filters
}: {
  catalog: ProductSearchResponse | null;
  filters: ProductSearchInput;
}) {
  const availableToyTypes = getSelectOptions(
    catalog?.meta.availableToyTypes ?? [],
    filters.toyType
  );

  return (
    <form action="/shop" className="shop-filters">
      <div className="shop-filters__heading">
        <div>
          <p className="shop-product__type">商品发现</p>
          <h2>按宠物档案筛选商品</h2>
        </div>
        <p>
          {catalog
            ? `${catalog.meta.total} 件商品匹配，价格区间 ${formatCents(
                catalog.meta.priceRange.minCents
              )}。`
            : "正在等待商品目录数据。"}
        </p>
      </div>

      <div className="shop-filters__fields">
        <label>
          关键词
          <input
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="商城数据加载失败"
          />
        </label>
        <label>
          宠物类型
          <select defaultValue={filters.petType ?? ""} name="petType">
            <option value="">全部宠物</option>
            <option value="dog">狗狗</option>
            <option value="cat">猫猫</option>
            <option value="both">通用</option>
          </select>
        </label>
        <label>
          玩具类型
          <select defaultValue={filters.toyType ?? ""} name="toyType">
            <option value="">全部玩具</option>
            {availableToyTypes.map((toyType) => (
              <option key={getToyTypeLabel(toyType)} value={toyType}>
                {getToyTypeLabel(toyType)}
              </option>
            ))}
          </select>
        </label>
        <label>
          最低价（分）
          <input
            defaultValue={filters.minPriceCents ?? ""}
            min="0"
            name="minPriceCents"
            placeholder="0"
            type="number"
          />
        </label>
        <label>
          最高价（分）
          <input
            defaultValue={filters.maxPriceCents ?? ""}
            min="0"
            name="maxPriceCents"
            placeholder="5000"
            type="number"
          />
        </label>
        <label>
          排序
          <select defaultValue={filters.sort ?? "default"} name="sort">
            <option value="default">综合排序</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
          </select>
        </label>
      </div>

      <div className="shop-filters__actions">
        <button className="shop-product__button" type="submit">
          应用筛选
        </button>
        <a href="/shop">清空筛选</a>
      </div>
    </form>
  );
}

function toProductSearchInput(
  searchParams: Awaited<ShopPageProps["searchParams"]>
): ProductSearchInput {
  return {
    q: toOptionalString(searchParams?.q),
    petType: toPetType(searchParams?.petType),
    toyType: toOptionalString(searchParams?.toyType),
    minPriceCents: toOptionalNumber(searchParams?.minPriceCents),
    maxPriceCents: toOptionalNumber(searchParams?.maxPriceCents),
    sort: toProductSort(searchParams?.sort)
  };
}

function toOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toOptionalNumber(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toPetType(value: string | undefined): ShopProduct["petType"] | undefined {
  return value === "dog" || value === "cat" || value === "both" ? value : undefined;
}

function toProductSort(value: string | undefined): ProductSort | undefined {
  return value === "price_asc" || value === "price_desc" || value === "default"
    ? value
    : undefined;
}

function getSelectOptions(options: string[], selected: string | undefined) {
  return [...new Set(selected ? [...options, selected] : options)].sort();
}
