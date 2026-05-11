export type PetType = "cat" | "dog" | "both";

export type ProductStatus = "active" | "draft" | "archived";

export interface ProductListItem {
  id: string;
  slug: string;
  title: string;
  petType: PetType;
  toyType: string;
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
