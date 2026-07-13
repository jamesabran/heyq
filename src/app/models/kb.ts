// Typed data contracts for the knowledge base. Shared "models" module so mock
// data conforms to it and a real API can adopt the same shapes later
// (docs/mock-data-model.md). IDs/slugs are opaque strings, never array indices.

export type KbArticleStatus = 'draft' | 'published';
export type KbVisibility = 'public' | 'internal';

export interface KbCategory {
  id: string;
  brandId: string;
  /** null = top-level category; otherwise the parent category id (subcategory). */
  parentId: string | null;
  slug: string;
  name: string;
  description?: string;
  /** Tabler icon name for the home grid (presentation hint, optional). */
  icon?: string;
  order: number;
}

export interface KbArticle {
  id: string;
  brandId: string;
  kbCategoryId: string;
  slug: string;
  title: string;
  /** Short summary for cards and search results. */
  excerpt: string;
  /** Body using a tiny convention: `## heading`, `- list item`, blank-line paragraphs. */
  body: string;
  status: KbArticleStatus;
  visibility: KbVisibility;
  ownerId: string;
  featured: boolean;
  order: number;
  publishedAt?: string;
  updatedAt: string;
}

// A point-in-time snapshot captured whenever an article is edited.
export interface KbRevision {
  id: string;
  articleId: string;
  editorId: string;
  title: string;
  body: string;
  createdAt: string;
}

/** An article is publicly readable only when published AND public. */
export function isPubliclyReadable(article: KbArticle): boolean {
  return article.status === 'published' && article.visibility === 'public';
}
