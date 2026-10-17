import type {
  CollectionItem,
  CustomKeyword,
  CustomTopic,
  LearningPlan,
  RelatedGroup,
  ResearchCollection,
  SaveStatus,
  SavedItemView,
  WeeklyReview,
} from "@/lib/server/library/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

export const libraryApi = {
  list: (filters: { q?: string; status?: SaveStatus | "all" }) =>
    request<{ items: SavedItemView[]; total: number }>(
      `/api/library?status=${filters.status ?? "all"}&q=${encodeURIComponent(filters.q ?? "")}`,
    ),

  save: (articleId: number) =>
    request<{ ok: boolean }>("/api/library", { method: "POST", body: JSON.stringify({ articleId }) }),

  unsave: (articleId: number) =>
    request<{ ok: boolean }>("/api/library", { method: "DELETE", body: JSON.stringify({ articleId }) }),

  update: (articleId: number, patch: Partial<{ status: SaveStatus | null; notes: string; tags: string[] }>) =>
    request<{ ok: boolean }>("/api/library", {
      method: "PATCH",
      body: JSON.stringify({ articleId, ...patch }),
    }),

  related: (articleId: number) =>
    request<{ article: { title: string }; groups: RelatedGroup[] }>(
      `/api/library/related?articleId=${articleId}`,
    ),

  topics: () => request<{ topics: CustomTopic[] }>("/api/library/topics"),
  createTopic: (name: string, description: string) =>
    request<{ topic: CustomTopic }>("/api/library/topics", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    }),
  deleteTopic: (id: number) =>
    request<{ ok: boolean }>("/api/library/topics", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  keywords: () => request<{ keywords: CustomKeyword[] }>("/api/library/keywords"),
  createKeyword: (keyword: string, topicId: number | null) =>
    request<{ keyword: CustomKeyword }>("/api/library/keywords", {
      method: "POST",
      body: JSON.stringify({ keyword, topicId }),
    }),
  deleteKeyword: (id: number) =>
    request<{ ok: boolean }>("/api/library/keywords", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),

  collections: () =>
    request<{ collections: ResearchCollection[] }>("/api/library/collections"),
  createCollection: (title: string, description: string) =>
    request<{ collection: ResearchCollection }>("/api/library/collections", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),
  deleteCollection: (id: number) =>
    request<{ ok: boolean }>("/api/library/collections", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }),
  collectionItems: (collectionId: number) =>
    request<{ items: CollectionItem[] }>(
      `/api/library/collections/items?collectionId=${collectionId}`,
    ),
  addCollectionItem: (collectionId: number, articleId: number, note: string) =>
    request<{ ok: boolean }>("/api/library/collections/items", {
      method: "POST",
      body: JSON.stringify({ collectionId, articleId, note }),
    }),
  removeCollectionItem: (collectionId: number, articleId: number) =>
    request<{ ok: boolean }>("/api/library/collections/items", {
      method: "DELETE",
      body: JSON.stringify({ collectionId, articleId }),
    }),

  weeklyReview: () => request<WeeklyReview>("/api/library/weekly-review"),
  suggestions: () => request<LearningPlan>("/api/library/suggestions"),
};
