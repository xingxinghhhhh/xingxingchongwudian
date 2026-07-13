import {
  PetType,
  ProductDetail,
  ProductListItem,
  ProductStatus
} from "./product.types";

export interface ProductRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  petType: PetType;
  toyType: string;
  status: ProductStatus;
  variants: ProductVariantRecord[];
  images: ProductImageRecord[];
}

export interface ProductVariantRecord {
  id: string;
  skuCode: string;
  name: string;
  color: string | null;
  size: string | null;
  material: string | null;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
}

export interface ProductImageRecord {
  id: string;
  url: string;
  sortOrder: number;
}

export function mapProductRecordToDetail(record: ProductRecord): ProductDetail {
  const images = getSortedImageUrls(record);
  const variants = record.variants.map((variant) => ({
    id: variant.id,
    skuCode: variant.skuCode,
    name: variant.name,
    color: variant.color ?? "",
    size: variant.size ?? "",
    material: variant.material ?? "",
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents ?? undefined,
    stock: variant.stock,
    isAvailable: variant.stock > 0
  }));

  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    petType: record.petType,
    toyType: record.toyType,
    tags: buildProductDiscoveryTags(record),
    priceCents: getLowestVariantPrice(variants),
    coverImageUrl: images[0] ?? "",
    images,
    status: record.status,
    variants
  };
}

export function mapProductRecordToListItem(
  record: ProductRecord
): ProductListItem {
  const detail = mapProductRecordToDetail(record);
  const { description, images, variants, ...listItem } = detail;
  return listItem;
}

function getSortedImageUrls(record: ProductRecord): string[] {
  return [...record.images]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((image) => image.url);
}

function getLowestVariantPrice(variants: ProductDetail["variants"]): number {
  return variants.reduce(
    (lowest, variant) => Math.min(lowest, variant.priceCents),
    variants[0]?.priceCents ?? 0
  );
}

function buildProductDiscoveryTags(record: ProductRecord): string[] {
  return normalizeProductTags([
    record.toyType,
    ...record.variants.flatMap((variant) => [
      variant.color,
      variant.size,
      variant.material
    ])
  ]);
}

function normalizeProductTags(values: Array<string | null | undefined>) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter((value): value is string => Boolean(value))
    )
  ].sort();
}
