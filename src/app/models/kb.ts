// Typed data contracts for the knowledge base. Shared "models" module so mock
// data conforms to it and a real API can adopt the same shapes later
// (docs/mock-data-model.md). IDs/slugs are opaque strings, never array indices.
//
// The KB holds two independently managed content types:
//   FAQs  — categorised support articles (KbCategory + KbArticle)
//   Legal — General TOS and its annexes (KbLegalDocument)
// They are separate models rather than one table with a flag: legal documents
// have no category and no internal visibility, and FAQs have no annex ordering
// relative to a parent TOS. Collapsing them would mean every consumer carries
// branches for fields that can't apply.

export type KbArticleStatus = 'draft' | 'published';
export type KbVisibility = 'public' | 'internal';

/** `tos` is the General Terms of Service; `annex` is an independent legal document. */
export type KbLegalKind = 'tos' | 'annex';

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
  /**
   * Uploaded category icon as a data URL. Takes precedence over `icon` when set,
   * so an admin can replace the built-in glyph without a code change.
   */
  iconUrl?: string;
  /**
   * Manual display position among siblings. Authored, never derived from
   * timestamps — admins reorder categories independently of when they were made.
   */
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
  /** Sanitized rich text (see lib/richText). Legacy bodies are mapped on read. */
  body: string;
  status: KbArticleStatus;
  visibility: KbVisibility;
  ownerId: string;
  featured: boolean;
  /** Manual display position within the category. */
  order: number;
  publishedAt?: string;
  updatedAt: string;
}

/**
 * A legal document: the General TOS or one of its annexes. Each annex is its own
 * editable document — the TOS is never one large article with annexes inlined,
 * so an annex can be revised, reordered, or unpublished on its own.
 */
export interface KbLegalDocument {
  id: string;
  brandId: string;
  slug: string;
  title: string;
  kind: KbLegalKind;
  /** Short summary for the legal index. */
  summary: string;
  /** Sanitized rich text (see lib/richText). */
  body: string;
  status: KbArticleStatus;
  ownerId: string;
  /** Manual display position across ALL legal documents, TOS and annexes alike. */
  order: number;
  publishedAt?: string;
  updatedAt: string;
}

// A point-in-time snapshot captured whenever an article is edited.
export interface KbRevision {
  id: string;
  /** The KbArticle or KbLegalDocument this snapshot belongs to. */
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

/**
 * Legal documents have no internal/public split — they are published to everyone
 * or not at all — so publication status alone gates public reads.
 */
export function isLegalPubliclyReadable(doc: KbLegalDocument): boolean {
  return doc.status === 'published';
}

export const LEGAL_KIND_LABELS: Record<KbLegalKind, string> = {
  tos: 'Terms of Service',
  annex: 'Annex',
};
