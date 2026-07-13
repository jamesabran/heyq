import { describe, expect, it } from 'vitest';
import {
  getArticleBySlug,
  listArticlesByCategory,
  listFeaturedArticles,
  listRelatedArticles,
  listTopLevelCategories,
  searchArticles,
} from './kbService';
import { isPubliclyReadable } from '../models/kb';

describe('kbService public visibility', () => {
  it('returns only top-level categories', async () => {
    const cats = await listTopLevelCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats.every((c) => c.parentId === null)).toBe(true);
  });

  it('resolves a published, public article by slug', async () => {
    const article = await getArticleBySlug('how-to-book-a-delivery');
    expect(article?.title).toBe('How to book a delivery');
  });

  it('never resolves an internal article by slug', async () => {
    expect(await getArticleBySlug('internal-escalation-runbook')).toBeNull();
  });

  it('never resolves a draft article by slug', async () => {
    expect(await getArticleBySlug('upcoming-feature-notes')).toBeNull();
  });

  it('excludes internal and draft articles from a category listing', async () => {
    // cat-technical contains one public, one internal, and one draft article.
    const articles = await listArticlesByCategory('cat-technical');
    expect(articles.every(isPubliclyReadable)).toBe(true);
    expect(articles.map((a) => a.slug)).toContain('app-troubleshooting');
    expect(articles.map((a) => a.slug)).not.toContain('internal-escalation-runbook');
    expect(articles.map((a) => a.slug)).not.toContain('upcoming-feature-notes');
  });

  it('only returns featured, publicly-readable articles', async () => {
    const featured = await listFeaturedArticles();
    expect(featured.length).toBeGreaterThan(0);
    expect(featured.every((a) => a.featured && isPubliclyReadable(a))).toBe(true);
  });

  it('search matches public content but not internal articles', async () => {
    const booking = await searchArticles('book');
    expect(booking.length).toBeGreaterThan(0);
    expect(booking.every(isPubliclyReadable)).toBe(true);

    // "runbook" appears only in the internal article, which must be filtered out.
    expect(await searchArticles('runbook')).toHaveLength(0);
  });

  it('returns empty search for a blank query', async () => {
    expect(await searchArticles('   ')).toHaveLength(0);
  });

  it('lists related articles from the same category, excluding the article itself', async () => {
    const article = await getArticleBySlug('how-to-book-a-delivery');
    const related = await listRelatedArticles(article!);
    expect(related.every((r) => r.kbCategoryId === article!.kbCategoryId)).toBe(true);
    expect(related.map((r) => r.id)).not.toContain(article!.id);
  });
});
