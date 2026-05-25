export interface CloudPetStats {
  mood: number;
  energy: number;
  intimacy: number;
}

export interface CloudPetEvent {
  type: string;
  title: string;
  body: string;
  createdAt: string;
}

export interface CloudPetProfile {
  petNo: string;
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
  avatarUrl: string;
  bio: string;
  stats: CloudPetStats;
  timeline: CloudPetEvent[];
}

export interface CreateCloudPetInput {
  ownerName: string;
  ownerPhone: string;
  name: string;
  species: "cat" | "dog";
  personality: string;
}

export interface CommunityPost {
  postNo: string;
  petNo: string;
  petName: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface CreateCommunityPostInput {
  petNo: string;
  authorName: string;
  body: string;
}

type Fetcher = typeof fetch;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";

export function createCloudPet(
  input: CreateCloudPetInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CloudPetProfile>(
    "/cloud-pets",
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
}

export function getCloudPet(petNo: string, fetcher: Fetcher = fetch) {
  return requestJson<CloudPetProfile>(
    `/cloud-pets/${encodeURIComponent(petNo)}`,
    { cache: "no-store" },
    fetcher
  );
}

export async function listCommunityPosts(fetcher: Fetcher = fetch) {
  const response = await requestJson<{ items: CommunityPost[] }>(
    "/community/posts",
    { cache: "no-store" },
    fetcher
  );

  return response.items;
}

export function createCommunityPost(
  input: CreateCommunityPostInput,
  fetcher: Fetcher = fetch
) {
  return requestJson<CommunityPost>(
    "/community/posts",
    {
      body: JSON.stringify(input),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    },
    fetcher
  );
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
