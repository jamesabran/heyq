import { describe, expect, it } from 'vitest';
import {
  createArticle,
  getArticleBySlug,
  listAllArticles,
  listRevisions,
  publishArticle,
  setArticleVisibility,
  updateArticle,
} from './kbService';

const draft = {
  title: 'Refunds and how they work',
  kbCategoryId: 'cat-payments',
  excerpt: 'How refunds are processed.',
  body: 'Refunds are returned to the original payment method.',
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
    await updateArticle(created.id, 'kb_editor', { body: 'Updated body text.' });
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
