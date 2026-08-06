export type CmsBlockStatus = "draft" | "published" | "archived";

export interface CmsBlock {
  blockNo: string;
  slotKey: string;
  title: string;
  body: string;
  ctaLabel?: string;
  href?: string;
  imageUrl?: string;
  status: CmsBlockStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCmsBlockInput {
  slotKey: string;
  title: string;
  body: string;
  ctaLabel?: string;
  href?: string;
  imageUrl?: string;
  status?: CmsBlockStatus;
  sortOrder?: number;
}

export interface UpdateCmsBlockStatusInput {
  status: CmsBlockStatus;
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export async function listCmsSlotBlocks(
  slotPrefix: string,
  fetcher: Fetcher = fetch
) {
  const response = await fetcher(
    `${API_BASE_URL}/cms/slots/${encodeURIComponent(slotPrefix)}`,
    { cache: "no-store" }
  );
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return payload.items as CmsBlock[];
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
