/**
 * kbService — knowledge-base facade for the public help center and admin area.
 *
 * The single seam a real API later replaces. All functions are async and return
 * cloned data (callers can't mutate seed state). Public consumers only ever see
 * PUBLISHED + PUBLIC articles and PUBLISHED legal documents — internal and draft
 * content is filtered out here so it can never leak to requesters
 * (docs/product-rules.md #5).
 *
 * The KB holds two independently managed content types. FAQs are categorised
 * articles; legal documents are the General TOS and its annexes. They share this
 * module but never share a list — an admin managing FAQs never sees legal
 * documents in a response, and vice versa.
 *
 * Bodies are stored and returned as sanitized rich text (lib/richText). Writes
 * sanitize on the way in, and reads map legacy `## heading` bodies forward, so a
 * consumer never has to know which convention a body was authored in.
 *
 * Future API endpoints:
 *   GET  /kb/categories                     → listTopLevelCategories
 *   GET  /kb/categories/:slug               → getCategoryBySlug
 *   GET  /kb/categories/:id/subcategories   → listSubcategories
 *   GET  /kb/categories/:id/articles        → listArticlesByCategory
 *   GET  /kb/articles?featured              → listFeaturedArticles
 *   GET  /kb/articles?q=                    → searchArticles
 *   GET  /kb/articles/:slug                 → getArticleBySlug
 *   GET  /kb/articles/:id/related           → listRelatedArticles
 *   GET  /kb/legal                          → listPublishedLegalDocuments
 *   GET  /kb/legal/:slug                    → getLegalDocumentBySlug
 *   POST /kb/legal/:id/move                 → moveLegalDocument
 */
import { kbArticles, kbCategories, kbLegalDocuments, kbRevisions } from '../data/kb';
import {
  isLegalPubliclyReadable,
  isPubliclyReadable,
  type KbArticle,
  type KbArticleStatus,
  type KbCategory,
  type KbLegalDocument,
  type KbLegalKind,
  type KbRevision,
  type KbVisibility,
} from '../models/kb';
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';
import { richTextToPlainText, toRichText } from '../lib/richText';

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/** Direction for a manual reorder. */
export type MoveDirection = 'up' | 'down';

/** Normalise a stored body to sanitized rich text on the way out. */
function readBody<T extends { body: string }>(record: T): T {
  return { ...clone(record), body: toRichText(record.body) };
}

function readBodies<T extends { body: string }>(records: T[]): T[] {
  return records.map(readBody);
}

/** Publicly readable articles, ordered. */
function publicArticles(): KbArticle[] {
  return kbArticles.filter(isPubliclyReadable).sort(byOrder);
}

export async function listTopLevelCategories(): Promise<KbCategory[]> {
  await simulateLatency();
  return clone(kbCategories.filter((c) => c.parentId === null).sort(byOrder));
}

export async function listSubcategories(parentId: string): Promise<KbCategory[]> {
  await simulateLatency();
  return clone(kbCategories.filter((c) => c.parentId === parentId).sort(byOrder));
}

/** All categories (flat) — for admin pickers and name lookups. */
export async function listAllCategories(): Promise<KbCategory[]> {
  await simulateLatency();
  return clone([...kbCategories].sort(byOrder));
}

export async function getCategoryBySlug(slug: string): Promise<KbCategory | null> {
  await simulateLatency();
  return clone(kbCategories.find((c) => c.slug === slug) ?? null);
}

export async function getCategoryById(id: string): Promise<KbCategory | null> {
  await simulateLatency();
  return clone(kbCategories.find((c) => c.id === id) ?? null);
}

interface ListArticlesOptions {
  includeSubcategories?: boolean;
}

export async function listArticlesByCategory(
  categoryId: string,
  options: ListArticlesOptions = {},
): Promise<KbArticle[]> {
  await simulateLatency();
  const categoryIds = new Set<string>([categoryId]);
  if (options.includeSubcategories) {
    kbCategories.filter((c) => c.parentId === categoryId).forEach((c) => categoryIds.add(c.id));
  }
  return readBodies(publicArticles().filter((a) => categoryIds.has(a.kbCategoryId)));
}

export async function listFeaturedArticles(limit = 6): Promise<KbArticle[]> {
  await simulateLatency();
  return readBodies(publicArticles().filter((a) => a.featured).slice(0, limit));
}

export async function getArticleBySlug(slug: string): Promise<KbArticle | null> {
  await simulateLatency();
  // Only publicly readable articles are resolvable here — internal/draft slugs
  // return null, so they never render in the public help center.
  const article = kbArticles.find((a) => a.slug === slug && isPubliclyReadable(a));
  return article ? readBody(article) : null;
}

export async function listRelatedArticles(article: KbArticle, limit = 3): Promise<KbArticle[]> {
  await simulateLatency();
  return readBodies(
    publicArticles()
      .filter((a) => a.kbCategoryId === article.kbCategoryId && a.id !== article.id)
      .slice(0, limit),
  );
}

export async function searchArticles(query: string): Promise<KbArticle[]> {
  await simulateLatency();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Search the rendered text, not the markup — otherwise a query like "li" or
  // "strong" would match every article through its tags.
  return readBodies(
    publicArticles().filter((a) =>
      `${a.title} ${a.excerpt} ${richTextToPlainText(toRichText(a.body))}`.toLowerCase().includes(q),
    ),
  );
}

// ── Legal documents — public reads ────────────────────────────────────────────

/** Published legal documents in authored order (TOS and annexes together). */
export async function listPublishedLegalDocuments(): Promise<KbLegalDocument[]> {
  await simulateLatency();
  return readBodies(kbLegalDocuments.filter(isLegalPubliclyReadable).sort(byOrder));
}

/** A published legal document by slug; drafts resolve to null for the public. */
export async function getLegalDocumentBySlug(slug: string): Promise<KbLegalDocument | null> {
  await simulateLatency();
  const doc = kbLegalDocuments.find((d) => d.slug === slug && isLegalPubliclyReadable(d));
  return doc ? readBody(doc) : null;
}

// ── Administration (M7) — unfiltered reads + authoring writes ─────────────────
// These see ALL content (draft + internal). They are used only by admin screens
// gated to KB editors/admins; the public functions above still filter.

/** Every FAQ article, ordered by category then manual order (admin list). */
export async function listAllArticles(): Promise<KbArticle[]> {
  await simulateLatency();
  const categoryOrder = new Map(kbCategories.map((c) => [c.id, c.order]));
  return readBodies(
    [...kbArticles].sort((a, b) => {
      if (a.kbCategoryId === b.kbCategoryId) return a.order - b.order;
      const ao = categoryOrder.get(a.kbCategoryId) ?? Number.MAX_SAFE_INTEGER;
      const bo = categoryOrder.get(b.kbCategoryId) ?? Number.MAX_SAFE_INTEGER;
      return ao === bo ? a.kbCategoryId.localeCompare(b.kbCategoryId) : ao - bo;
    }),
  );
}

/** Any article by id, regardless of status/visibility (admin editor). */
export async function getArticleForEdit(id: string): Promise<KbArticle | null> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  return article ? readBody(article) : null;
}

export interface ArticleDraftInput {
  title: string;
  kbCategoryId: string;
  excerpt: string;
  body: string;
  visibility: KbVisibility;
  order?: number;
}

/** Create a new draft article. */
export async function createArticle(input: ArticleDraftInput, editorId: string): Promise<KbArticle> {
  await simulateLatency();
  const now = nowIso();
  const article: KbArticle = {
    id: makeId('art'),
    brandId: 'ggx',
    kbCategoryId: input.kbCategoryId,
    slug: slugify(input.title),
    title: input.title.trim(),
    excerpt: input.excerpt.trim(),
    body: toRichText(input.body),
    status: 'draft',
    visibility: input.visibility,
    ownerId: editorId,
    featured: false,
    order: input.order ?? nextOrder(kbArticles.filter((a) => a.kbCategoryId === input.kbCategoryId)),
    updatedAt: now,
  };
  kbArticles.push(article);
  return readBody(article);
}

/** Update an article, snapshotting the previous title/body as a revision. */
export async function updateArticle(id: string, editorId: string, changes: Partial<ArticleDraftInput>): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');

  kbRevisions.push({
    id: makeId('rev'), articleId: id, editorId,
    title: article.title, body: article.body, createdAt: nowIso(),
  });

  if (changes.title !== undefined) { article.title = changes.title.trim(); article.slug = slugify(changes.title); }
  if (changes.excerpt !== undefined) article.excerpt = changes.excerpt.trim();
  // Sanitize on write as well as read: a body must never be stored with markup
  // the renderer would then have to defend against.
  if (changes.body !== undefined) article.body = toRichText(changes.body);
  if (changes.kbCategoryId !== undefined) article.kbCategoryId = changes.kbCategoryId;
  if (changes.visibility !== undefined) article.visibility = changes.visibility;
  if (changes.order !== undefined) article.order = changes.order;
  article.updatedAt = nowIso();
  return readBody(article);
}

export async function publishArticle(id: string): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.status = 'published';
  article.publishedAt = nowIso();
  article.updatedAt = article.publishedAt;
  return readBody(article);
}

export async function unpublishArticle(id: string): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.status = 'draft';
  article.updatedAt = nowIso();
  return readBody(article);
}

export async function setArticleVisibility(id: string, visibility: KbVisibility): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.visibility = visibility;
  article.updatedAt = nowIso();
  return readBody(article);
}

/**
 * Move an article one position within its category. Sibling scope is the
 * category, so reordering one category never disturbs another.
 */
export async function moveArticle(id: string, direction: MoveDirection): Promise<KbArticle[]> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  const siblings = kbArticles.filter((a) => a.kbCategoryId === article.kbCategoryId);
  swapOrder(siblings, id, direction);
  return readBodies([...siblings].sort(byOrder));
}

export async function listRevisions(articleId: string): Promise<KbRevision[]> {
  await simulateLatency();
  return readBodies(
    kbRevisions.filter((r) => r.articleId === articleId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

// ── FAQ category administration ───────────────────────────────────────────────

export interface CategoryInput {
  name: string;
  description?: string;
  parentId?: string | null;
  /** Uploaded icon as a data URL; '' clears it and falls back to `icon`. */
  iconUrl?: string;
  icon?: string;
}

export async function createCategory(input: CategoryInput): Promise<KbCategory> {
  await simulateLatency();
  const parentId = input.parentId ?? null;
  const category: KbCategory = {
    id: makeId('cat'),
    brandId: 'ggx',
    parentId,
    slug: slugify(input.name),
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    icon: input.icon,
    iconUrl: input.iconUrl || undefined,
    order: nextOrder(kbCategories.filter((c) => c.parentId === parentId)),
  };
  kbCategories.push(category);
  return clone(category);
}

export async function updateCategory(id: string, changes: CategoryInput): Promise<KbCategory> {
  await simulateLatency();
  const category = kbCategories.find((c) => c.id === id);
  if (!category) throw new Error('Category not found');

  if (changes.name !== undefined) { category.name = changes.name.trim(); category.slug = slugify(changes.name); }
  if (changes.description !== undefined) category.description = changes.description.trim() || undefined;
  if (changes.icon !== undefined) category.icon = changes.icon || undefined;
  // '' is a meaningful value here — it removes an uploaded icon.
  if (changes.iconUrl !== undefined) category.iconUrl = changes.iconUrl || undefined;
  return clone(category);
}

/** Move a category one position among its siblings (top-level or within a parent). */
export async function moveCategory(id: string, direction: MoveDirection): Promise<KbCategory[]> {
  await simulateLatency();
  const category = kbCategories.find((c) => c.id === id);
  if (!category) throw new Error('Category not found');
  const siblings = kbCategories.filter((c) => c.parentId === category.parentId);
  swapOrder(siblings, id, direction);
  return clone([...siblings].sort(byOrder));
}

/** Delete a category. Refuses while it still holds articles or subcategories. */
export async function deleteCategory(id: string): Promise<void> {
  await simulateLatency();
  if (kbArticles.some((a) => a.kbCategoryId === id)) {
    throw new Error('Move or delete this category’s articles first.');
  }
  if (kbCategories.some((c) => c.parentId === id)) {
    throw new Error('Delete this category’s subcategories first.');
  }
  const index = kbCategories.findIndex((c) => c.id === id);
  if (index >= 0) kbCategories.splice(index, 1);
}

// ── Legal document administration ─────────────────────────────────────────────

/** Every legal document in authored order, drafts included (admin list). */
export async function listAllLegalDocuments(): Promise<KbLegalDocument[]> {
  await simulateLatency();
  return readBodies([...kbLegalDocuments].sort(byOrder));
}

/** Any legal document by id, regardless of status (admin editor). */
export async function getLegalDocumentForEdit(id: string): Promise<KbLegalDocument | null> {
  await simulateLatency();
  const doc = kbLegalDocuments.find((d) => d.id === id);
  return doc ? readBody(doc) : null;
}

export interface LegalDraftInput {
  title: string;
  kind: KbLegalKind;
  summary: string;
  body: string;
  order?: number;
}

export async function createLegalDocument(input: LegalDraftInput, editorId: string): Promise<KbLegalDocument> {
  await simulateLatency();
  const doc: KbLegalDocument = {
    id: makeId('legal'),
    brandId: 'ggx',
    slug: slugify(input.title),
    title: input.title.trim(),
    kind: input.kind,
    summary: input.summary.trim(),
    body: toRichText(input.body),
    status: 'draft',
    ownerId: editorId,
    // Appended, never inserted: nothing about a new annex implies it belongs
    // above an existing one. An admin reorders it deliberately.
    order: input.order ?? nextOrder(kbLegalDocuments),
    updatedAt: nowIso(),
  };
  kbLegalDocuments.push(doc);
  return readBody(doc);
}

export async function updateLegalDocument(
  id: string,
  editorId: string,
  changes: Partial<LegalDraftInput>,
): Promise<KbLegalDocument> {
  await simulateLatency();
  const doc = kbLegalDocuments.find((d) => d.id === id);
  if (!doc) throw new Error('Legal document not found');

  kbRevisions.push({
    id: makeId('rev'), articleId: id, editorId,
    title: doc.title, body: doc.body, createdAt: nowIso(),
  });

  if (changes.title !== undefined) { doc.title = changes.title.trim(); doc.slug = slugify(changes.title); }
  if (changes.summary !== undefined) doc.summary = changes.summary.trim();
  if (changes.body !== undefined) doc.body = toRichText(changes.body);
  if (changes.kind !== undefined) doc.kind = changes.kind;
  if (changes.order !== undefined) doc.order = changes.order;
  doc.updatedAt = nowIso();
  return readBody(doc);
}

export async function publishLegalDocument(id: string): Promise<KbLegalDocument> {
  await simulateLatency();
  const doc = kbLegalDocuments.find((d) => d.id === id);
  if (!doc) throw new Error('Legal document not found');
  doc.status = 'published';
  doc.publishedAt = nowIso();
  doc.updatedAt = doc.publishedAt;
  return readBody(doc);
}

export async function unpublishLegalDocument(id: string): Promise<KbLegalDocument> {
  await simulateLatency();
  const doc = kbLegalDocuments.find((d) => d.id === id);
  if (!doc) throw new Error('Legal document not found');
  doc.status = 'draft';
  doc.updatedAt = nowIso();
  return readBody(doc);
}

/**
 * Move a legal document one position. The TOS and annexes share a single
 * ordering scope, so the TOS can be moved like any other document rather than
 * being pinned to the top by its kind or its creation date.
 */
export async function moveLegalDocument(id: string, direction: MoveDirection): Promise<KbLegalDocument[]> {
  await simulateLatency();
  if (!kbLegalDocuments.some((d) => d.id === id)) throw new Error('Legal document not found');
  swapOrder(kbLegalDocuments, id, direction);
  return readBodies([...kbLegalDocuments].sort(byOrder));
}

// ── Link targets for the editor's internal-link picker ────────────────────────

export interface KbLinkTarget {
  /** In-app path, e.g. `/help/a/track-your-shipment`. */
  href: string;
  label: string;
  group: 'FAQs' | 'TOS & Policies';
}

/**
 * Every article and legal document an editor can link to, published or not.
 * Drafts are offered deliberately: an annex routinely links to a sibling that is
 * still in review, and the link resolves the moment that sibling is published.
 */
export async function listLinkTargets(): Promise<KbLinkTarget[]> {
  await simulateLatency();
  return [
    ...[...kbArticles]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((a): KbLinkTarget => ({ href: `/help/a/${a.slug}`, label: a.title, group: 'FAQs' })),
    ...[...kbLegalDocuments]
      .sort(byOrder)
      .map((d): KbLinkTarget => ({ href: `/help/legal/${d.slug}`, label: d.title, group: 'TOS & Policies' })),
  ];
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Next position at the end of a sibling set. */
function nextOrder(siblings: { order: number }[]): number {
  return siblings.reduce((max, s) => Math.max(max, s.order), 0) + 1;
}

/**
 * Swap a record with its neighbour in `order`. Swapping (rather than rewriting
 * every position) keeps unrelated records untouched, and a move at either end is
 * a no-op instead of an error — the UI disables those buttons anyway.
 */
function swapOrder<T extends { id: string; order: number }>(
  siblings: T[],
  id: string,
  direction: MoveDirection,
): void {
  const sorted = [...siblings].sort(byOrder);
  const index = sorted.findIndex((s) => s.id === id);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= sorted.length) return;

  const current = sorted[index];
  const neighbour = sorted[target];
  // Seed data may share or skip order values; normalise to positions so a swap
  // is always a real move rather than exchanging two identical numbers.
  sorted.forEach((s, i) => { s.order = i + 1; });
  const swapped = current.order;
  current.order = neighbour.order;
  neighbour.order = swapped;
}

/** Filter helper shared by both admin lists. */
export function matchesStatusFilter(
  status: KbArticleStatus,
  filter: KbArticleStatus | 'all',
): boolean {
  return filter === 'all' || status === filter;
}

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}
