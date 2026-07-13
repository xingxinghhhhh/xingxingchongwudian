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
      caught instanceof Error ? caught.message : "Product API is temporarily unavailable.";
  }

  return (
    <main className="shop-page">
      <SiteHeader />

      <section className="shop-hero">
        <div className="shop-hero__inner">
          <p className="section__kicker">Shop</p>
          <h1>Pet toy commerce center</h1>
          <p>
            Search pet-matched toys, add them to cart, checkout, simulate payment,
            and submit reviews through the live commerce APIs.
          </p>
        </div>
      </section>

      <section className="shop-section">
        {loadError ? (
          <div className="shop-error" role="alert">
            <h2>Products failed to load</h2>
            <p>{loadError}</p>
          </div>
        ) : (
          <>
            <ProductDiscoveryForm catalog={catalog} filters={filters} />
            {products.length === 0 ? (
              <div className="shop-empty">
                <p className="shop-product__type">No matches</p>
                <h2>No products matched these filters.</h2>
                <p>
                  {catalog?.meta.recommendationReason ??
                    "Try removing a price range or switching pet type."}
                </p>
                {recommendedProducts.length > 0 ? (
                  <div className="shop-empty__actions">
                    <span>{recommendedProducts.length} in-stock picks are ready below.</span>
                    <a href="/shop">Reset catalog</a>
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
          <p className="shop-product__type">Product discovery</p>
          <h2>Search and filter the catalog</h2>
        </div>
        <p>
          {catalog
            ? `${catalog.meta.total} products matched. Price range ${formatCents(
                catalog.meta.priceRange.minCents
              )} - ${formatCents(catalog.meta.priceRange.maxCents)}.`
            : "Use filters to find the right toy faster."}
        </p>
      </div>

      <div className="shop-filters__fields">
        <label>
          Keyword
          <input
            defaultValue={filters.q ?? ""}
            name="q"
            placeholder="rope, wand, chew"
          />
        </label>
        <label>
          Pet type
          <select defaultValue={filters.petType ?? ""} name="petType">
            <option value="">All pets</option>
            <option value="dog">Dog</option>
            <option value="cat">Cat</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label>
          Toy type
          <select defaultValue={filters.toyType ?? ""} name="toyType">
            <option value="">All toys</option>
            {availableToyTypes.map((toyType) => (
              <option key={toyType} value={toyType}>
                {toyType}
              </option>
            ))}
          </select>
        </label>
        <label>
          Min price cents
          <input
            defaultValue={filters.minPriceCents ?? ""}
            min="0"
            name="minPriceCents"
            placeholder="0"
            type="number"
          />
        </label>
        <label>
          Max price cents
          <input
            defaultValue={filters.maxPriceCents ?? ""}
            min="0"
            name="maxPriceCents"
            placeholder="5000"
            type="number"
          />
        </label>
        <label>
          Sort
          <select defaultValue={filters.sort ?? "default"} name="sort">
            <option value="default">Featured</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
          </select>
        </label>
      </div>

      <div className="shop-filters__actions">
        <button className="shop-product__button" type="submit">
          Apply filters
        </button>
        <a href="/shop">Reset catalog</a>
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
