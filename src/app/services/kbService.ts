/**
 * kbService — knowledge-base read facade for the public help center.
 *
 * The single seam a real API later replaces. All functions are async and return
 * cloned data (callers can't mutate seed state). Public consumers only ever see
 * PUBLISHED + PUBLIC articles — internal and draft articles are filtered out
 * here so they can never leak to requesters (docs/product-rules.md #5).
 *
 * Future API endpoints:
 *   GET /kb/categories                     → listTopLevelCategories
 *   GET /kb/categories/:slug               → getCategoryBySlug
 *   GET /kb/categories/:id/subcategories   → listSubcategories
 *   GET /kb/categories/:id/articles        → listArticlesByCategory
 *   GET /kb/articles?featured              → listFeaturedArticles
 *   GET /kb/articles?q=                    → searchArticles
 *   GET /kb/articles/:slug                 → getArticleBySlug
 *   GET /kb/articles/:id/related           → listRelatedArticles
 */
import { kbArticles, kbCategories, kbRevisions } from '../data/kb';
import {
  isPubliclyReadable,
  type KbArticle,
  type KbCategory,
  type KbRevision,
  type KbVisibility,
} from '../models/kb';
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

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
  return clone(publicArticles().filter((a) => categoryIds.has(a.kbCategoryId)));
}

export async function listFeaturedArticles(limit = 6): Promise<KbArticle[]> {
  await simulateLatency();
  return clone(publicArticles().filter((a) => a.featured).slice(0, limit));
}

export async function getArticleBySlug(slug: string): Promise<KbArticle | null> {
  await simulateLatency();
  // Only publicly readable articles are resolvable here — internal/draft slugs
  // return null, so they never render in the public help center.
  const article = kbArticles.find((a) => a.slug === slug && isPubliclyReadable(a));
  return clone(article ?? null);
}

export async function listRelatedArticles(article: KbArticle, limit = 3): Promise<KbArticle[]> {
  await simulateLatency();
  return clone(
    publicArticles()
      .filter((a) => a.kbCategoryId === article.kbCategoryId && a.id !== article.id)
      .slice(0, limit),
  );
}

export async function searchArticles(query: string): Promise<KbArticle[]> {
  await simulateLatency();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return clone(
    publicArticles().filter((a) =>
      `${a.title} ${a.excerpt} ${a.body}`.toLowerCase().includes(q),
    ),
  );
}

// ── Administration (M7) — unfiltered reads + authoring writes ─────────────────
// These see ALL articles (draft + internal). They are used only by admin screens
// gated to KB editors/admins; the public functions above still filter.

/** Every article, ordered by category then order (admin list). */
export async function listAllArticles(): Promise<KbArticle[]> {
  await simulateLatency();
  return clone(
    [...kbArticles].sort((a, b) =>
      a.kbCategoryId === b.kbCategoryId ? a.order - b.order : a.kbCategoryId.localeCompare(b.kbCategoryId),
    ),
  );
}

/** Any article by id, regardless of status/visibility (admin editor). */
export async function getArticleForEdit(id: string): Promise<KbArticle | null> {
  await simulateLatency();
  return clone(kbArticles.find((a) => a.id === id) ?? null);
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
    body: input.body,
    status: 'draft',
    visibility: input.visibility,
    ownerId: editorId,
    featured: false,
    order: input.order ?? kbArticles.filter((a) => a.kbCategoryId === input.kbCategoryId).length + 1,
    updatedAt: now,
  };
  kbArticles.push(article);
  return clone(article);
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
  if (changes.body !== undefined) article.body = changes.body;
  if (changes.kbCategoryId !== undefined) article.kbCategoryId = changes.kbCategoryId;
  if (changes.visibility !== undefined) article.visibility = changes.visibility;
  if (changes.order !== undefined) article.order = changes.order;
  article.updatedAt = nowIso();
  return clone(article);
}

export async function publishArticle(id: string): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.status = 'published';
  article.publishedAt = nowIso();
  article.updatedAt = article.publishedAt;
  return clone(article);
}

export async function unpublishArticle(id: string): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.status = 'draft';
  article.updatedAt = nowIso();
  return clone(article);
}

export async function setArticleVisibility(id: string, visibility: KbVisibility): Promise<KbArticle> {
  await simulateLatency();
  const article = kbArticles.find((a) => a.id === id);
  if (!article) throw new Error('Article not found');
  article.visibility = visibility;
  article.updatedAt = nowIso();
  return clone(article);
}

export async function listRevisions(articleId: string): Promise<KbRevision[]> {
  await simulateLatency();
  return clone(
    kbRevisions.filter((r) => r.articleId === articleId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

function slugify(title: string): string {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}
