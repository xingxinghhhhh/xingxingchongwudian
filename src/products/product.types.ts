export type PetType = "cat" | "dog" | "both";

export type ProductStatus = "active" | "draft" | "archived";

export type ProductSort = "default" | "price_asc" | "price_desc";

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  petType: PetType;
  toyType: string;
  tags: string[];
  priceCents: number;
  coverImageUrl: string;
  status: ProductStatus;
}

export interface ProductVariant {
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

export interface ProductDetail extends ProductListItem {
  description: string;
  images: string[];
  variants: ProductVariant[];
}

export interface ProductSearchFilters {
  q?: string;
  petType?: PetType;
  toyType?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: ProductSort;
}

export interface ProductSearchMeta {
  total: number;
  filters: Omit<ProductSearchFilters, "sort">;
  sort: ProductSort;
  availablePetTypes: PetType[];
  availableToyTypes: string[];
  availableTags: string[];
  priceRange: {
    minCents: number;
    maxCents: number;
  };
  recommendedItems: ProductListItem[];
  recommendationReason?: string;
}

export interface ProductSearchResult {
  items: ProductListItem[];
  meta: ProductSearchMeta;
}
