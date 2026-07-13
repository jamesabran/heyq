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
import { kbArticles, kbCategories } from '../data/kb';
import { isPubliclyReadable, type KbArticle, type KbCategory } from '../models/kb';
import { clone, simulateLatency } from '../lib/mock';

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
