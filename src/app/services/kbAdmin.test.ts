import { describe, expect, it } from 'vitest';
import {
  createArticle,
  createCategory,
  createLegalDocument,
  deleteCategory,
  getArticleBySlug,
  getLegalDocumentBySlug,
  listAllArticles,
  listAllCategories,
  listAllLegalDocuments,
  listLinkTargets,
  listPublishedLegalDocuments,
  listRevisions,
  moveArticle,
  moveCategory,
  moveLegalDocument,
  publishArticle,
  publishLegalDocument,
  searchArticles,
  setArticleVisibility,
  unpublishLegalDocument,
  updateArticle,
  updateCategory,
} from './kbService';

const draft = {
  title: 'Refunds and how they work',
  kbCategoryId: 'cat-payments',
  excerpt: 'How refunds are processed.',
  body: '<p>Refunds are returned to the original payment method.</p>',
  visibility: 'public' as const,
};

describe('kb administration', () => {
  it('lists all articles including drafts and internal ones', async () => {
    const all = await listAllArticles();
    const slugs = all.map((a) => a.slug);
    expect(slugs).toContain('internal-escalation-runbook'); // internal
    expect(slugs).toContain('upcoming-feature-notes'); // draft
  });

  it('creates a draft that is not publicly readable until published', async () => {
    const created = await createArticle(draft, 'kb_editor');
    expect(created.status).toBe('draft');
    expect(await getArticleBySlug(created.slug)).toBeNull();

    const published = await publishArticle(created.id);
    expect(published.status).toBe('published');
    expect((await getArticleBySlug(created.slug))?.id).toBe(created.id);
  });

  it('records a revision when an article is edited', async () => {
    const created = await createArticle(draft, 'kb_editor');
    await updateArticle(created.id, 'kb_editor', { body: '<p>Updated body text.</p>' });
    const revisions = await listRevisions(created.id);
    expect(revisions.length).toBe(1);
    expect(revisions[0].body).toBe(draft.body); // snapshot of the PREVIOUS body
  });

  it('keeps an internal article out of the public help center even when published', async () => {
    const created = await createArticle({ ...draft, title: 'Agent-only payments runbook' }, 'kb_editor');
    await setArticleVisibility(created.id, 'internal');
    await publishArticle(created.id);
    expect(await getArticleBySlug(created.slug)).toBeNull();
  });
});

describe('rich-text bodies', () => {
  it('sanitizes a body on write so unsafe markup is never stored', async () => {
    const created = await createArticle(
      { ...draft, title: 'Sanitised on write', body: '<p onclick="steal()">Hi</p><script>alert(1)</script>' },
      'kb_editor',
    );
    expect(created.body).toBe('<p>Hi</p>');
  });

  it('preserves nested lists and links through a save/reload cycle', async () => {
    const body =
      '<h2>Steps</h2><ol><li>First<ul><li>Nested detail</li></ul></li><li>Second</li></ol>' +
      '<p>See <a href="/help/legal/privacy-policy#data-we-collect">the annex</a>.</p>';
    const created = await createArticle({ ...draft, title: 'Formatting survives', body }, 'kb_editor');
    expect(created.body).toBe(body);

    const reloaded = await publishArticle(created.id);
    expect(reloaded.body).toBe(body);
    expect((await getArticleBySlug(created.slug))?.body).toBe(body);
  });

  it('maps a legacy body forward on read without a second stored field', async () => {
    // Legacy convention in, rich text out — nothing needs migrating in place.
    const created = await createArticle(
      { ...draft, title: 'Legacy convention body', body: '## Heading\n- item one' },
      'kb_editor',
    );
    expect(created.body).toBe('<h2>Heading</h2><ul><li>item one</li></ul>');
  });

  it('searches article text rather than its markup', async () => {
    // "strong" appears in tags across the seed data but in no article's prose.
    expect(await searchArticles('strong')).toEqual([]);
    const hits = await searchArticles('tracking number');
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe('manual reordering', () => {
  it('moves an article within its category without touching other categories', async () => {
    const before = (await listAllArticles()).filter((a) => a.kbCategoryId === 'cat-deliveries');
    const otherBefore = (await listAllArticles()).filter((a) => a.kbCategoryId === 'cat-account');

    const moved = await moveArticle(before[1].id, 'up');
    expect(moved.map((a) => a.id).slice(0, 2)).toEqual([before[1].id, before[0].id]);

    const otherAfter = (await listAllArticles()).filter((a) => a.kbCategoryId === 'cat-account');
    expect(otherAfter.map((a) => a.id)).toEqual(otherBefore.map((a) => a.id));
  });

  it('is a no-op at the boundaries', async () => {
    const first = (await listAllArticles()).filter((a) => a.kbCategoryId === 'cat-returns')[0];
    const after = await moveArticle(first.id, 'up');
    expect(after[0].id).toBe(first.id);
  });

  it('reorders categories independently of their articles', async () => {
    const before = (await listAllCategories()).filter((c) => c.parentId === null);
    const articlesBefore = (await listAllArticles()).filter((a) => a.kbCategoryId === before[0].id);

    const moved = await moveCategory(before[1].id, 'up');
    const topLevel = moved.filter((c) => c.parentId === null);
    expect(topLevel.slice(0, 2).map((c) => c.id)).toEqual([before[1].id, before[0].id]);

    const articlesAfter = (await listAllArticles()).filter((a) => a.kbCategoryId === before[0].id);
    expect(articlesAfter.map((a) => a.id)).toEqual(articlesBefore.map((a) => a.id));

    await moveCategory(before[1].id, 'down'); // restore for other tests
  });

  it('reorders legal documents regardless of creation date, TOS included', async () => {
    const before = await listAllLegalDocuments();
    expect(before[0].kind).toBe('tos');

    // The TOS is ordered, not pinned — it can be moved like any other document.
    const moved = await moveLegalDocument(before[0].id, 'down');
    expect(moved[0].id).toBe(before[1].id);
    expect(moved[1].id).toBe(before[0].id);

    await moveLegalDocument(before[0].id, 'up'); // restore
    expect((await listAllLegalDocuments())[0].id).toBe(before[0].id);
  });
});

describe('legal documents', () => {
  it('hides a draft annex from the public index and by slug', async () => {
    const published = await listPublishedLegalDocuments();
    expect(published.map((d) => d.slug)).not.toContain('data-processing-addendum');
    expect(await getLegalDocumentBySlug('data-processing-addendum')).toBeNull();

    // …but an admin still sees it.
    expect((await listAllLegalDocuments()).map((d) => d.slug)).toContain('data-processing-addendum');
  });

  it('keeps each annex independently editable and publishable', async () => {
    const created = await createLegalDocument(
      { title: 'Annex Z — Pilot Terms', kind: 'annex', summary: 'Pilot programme terms.', body: '<p>Pilot.</p>' },
      'kb_editor',
    );
    expect(created.status).toBe('draft');
    expect(await getLegalDocumentBySlug(created.slug)).toBeNull();

    await publishLegalDocument(created.id);
    expect((await getLegalDocumentBySlug(created.slug))?.title).toBe('Annex Z — Pilot Terms');

    // Unpublishing one annex leaves the rest of the set published.
    await unpublishLegalDocument(created.id);
    expect(await getLegalDocumentBySlug(created.slug)).toBeNull();
    expect((await listPublishedLegalDocuments()).length).toBeGreaterThan(1);
  });

  it('does not cap the number of annexes', async () => {
    const before = (await listAllLegalDocuments()).length;
    for (let i = 0; i < 5; i += 1) {
      await createLegalDocument(
        { title: `Annex bulk ${i}`, kind: 'annex', summary: 's', body: '<p>b</p>' },
        'kb_editor',
      );
    }
    const after = await listAllLegalDocuments();
    expect(after.length).toBe(before + 5);
    // Appended in order, each with its own position.
    expect(new Set(after.map((d) => d.order)).size).toBe(after.length);
  });

  it('offers both FAQs and legal documents as internal link targets', async () => {
    const targets = await listLinkTargets();
    expect(targets.some((t) => t.group === 'FAQs' && t.href.startsWith('/help/a/'))).toBe(true);
    expect(targets.some((t) => t.href === '/help/legal/general-terms-of-service')).toBe(true);
  });
});

describe('faq categories', () => {
  it('creates a category and assigns an uploaded icon', async () => {
    const created = await createCategory({ name: 'Bulk Shipping' });
    expect(created.slug).toBe('bulk-shipping');
    expect(created.iconUrl).toBeUndefined();

    const withIcon = await updateCategory(created.id, {
      name: 'Bulk Shipping',
      iconUrl: 'data:image/png;base64,iVBORw0KGgo=',
    });
    expect(withIcon.iconUrl).toBe('data:image/png;base64,iVBORw0KGgo=');

    // Clearing the upload falls back to the built-in glyph.
    const cleared = await updateCategory(created.id, { name: 'Bulk Shipping', iconUrl: '' });
    expect(cleared.iconUrl).toBeUndefined();

    await deleteCategory(created.id);
  });

  it('refuses to delete a category that still holds articles', async () => {
    await expect(deleteCategory('cat-payments')).rejects.toThrow(/articles first/i);
  });
});
