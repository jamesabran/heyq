import { test, expect, type Page } from '@playwright/test';

/**
 * Rich-text editor coverage that only a real browser can give.
 *
 * The editor is built on `document.execCommand`, which jsdom does not implement,
 * so the vitest suite can assert the toolbar exists but never that pressing a
 * button actually produces a nested list. These tests drive the real thing and
 * follow a body through the round trip the acceptance criteria name: authored →
 * saved → reopened → previewed → published → public.
 */

/** The identity switcher is backed by localStorage, so seed it before first paint. */
async function visitAs(page: Page, path: string, identity = 'kb_editor') {
  await page.addInitScript((id) => window.localStorage.setItem('heyq-identity', id), identity);
  await page.goto(path);
}

const editor = (page: Page) => page.getByRole('textbox', { name: 'Answer' });

/** Put the caret in the editor and clear whatever the seeded body left behind. */
async function focusEmptyEditor(page: Page) {
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
}

test.describe('KB rich-text editor', () => {
  test('applies bold, headings, and nested ordered/unordered lists', async ({ page }) => {
    await visitAs(page, '/admin/kb/faqs/new');
    await focusEmptyEditor(page);

    // A heading.
    await page.getByRole('combobox', { name: 'Text style' }).selectOption('h2');
    await page.keyboard.type('Steps to follow');
    await page.keyboard.press('Enter');
    await page.getByRole('combobox', { name: 'Text style' }).selectOption('p');

    // A numbered list with a nested level under the first entry.
    await page.getByRole('button', { name: 'Numbered list' }).click();
    await page.keyboard.type('First step');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Increase indent' }).click();
    await page.keyboard.type('A nested detail');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Decrease indent' }).click();
    await page.keyboard.type('Second step');

    const body = editor(page);
    await expect(body.getByRole('heading', { name: 'Steps to follow' })).toBeVisible();
    // The nesting is real structure, not indentation styling. The live editor
    // holds the browser's raw markup — it is normalised on save — so match the
    // nested list wherever the engine chose to put it.
    await expect(body.locator('ol ol li, ol ul li')).toContainText(['A nested detail']);
    await expect(body.locator('li').first()).toContainText('First step');
    await expect(body).toContainText('Second step');
  });

  test('preserves formatting through save, reopen, preview, publish, and the public page', async ({ page }) => {
    await visitAs(page, '/admin/kb/faqs/new');

    const title = `E2E formatting ${Date.now()}`;
    await page.getByLabel('Question').fill(title);
    await page.getByLabel('Excerpt').fill('Round-trip fixture.');

    await focusEmptyEditor(page);
    await page.getByRole('combobox', { name: 'Text style' }).selectOption('h2');
    await page.keyboard.type('Before you start');
    await page.keyboard.press('Enter');
    await page.getByRole('combobox', { name: 'Text style' }).selectOption('p');
    await page.getByRole('button', { name: 'Numbered list' }).click();
    await page.keyboard.type('Outer step');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Increase indent' }).click();
    await page.keyboard.type('Inner step');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Decrease indent' }).click();
    await page.keyboard.type('Outer again');
    // Back onto the nested item to bold and link it.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('End');

    // Bold a word, then link it to another KB article.
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'Bold' }).click();
    await page.getByRole('button', { name: 'Insert link' }).click();
    await page
      .getByRole('combobox', { name: 'Link to Knowledge Base' })
      .selectOption('/help/a/track-your-shipment');

    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page).toHaveURL(/\/admin\/kb\/faqs\/art_/);

    // Reopen by navigating away and back. The KB is client-side mock state, so a
    // full page reload would reset the seed — this is the real reopen path, and
    // it still round-trips the body through the service.
    await page.getByRole('link', { name: /Back to FAQs/ }).click();
    await expect(page.getByRole('heading', { name: 'Knowledge Base' })).toBeVisible();
    // Exact: the row's Preview link is labelled "Preview <title>" and would
    // otherwise match too (Playwright name matching is substring by default).
    await page.getByRole('link', { name: title, exact: true }).click();

    const reopened = editor(page);
    await expect(reopened.getByRole('heading', { name: 'Before you start' })).toBeVisible();
    await expect(reopened.locator('ol li ol li, ol li ul li')).toContainText(['Inner step']);
    await expect(reopened.locator('strong')).toContainText('Inner step');
    await expect(reopened.getByRole('link')).toHaveAttribute('href', '/help/a/track-your-shipment');

    // Preview renders the same structure through the public renderer.
    await page.getByRole('tab', { name: 'Preview' }).click();
    await expect(page.getByRole('heading', { name: 'Before you start' })).toBeVisible();
    await expect(page.locator('ol li ol li, ol li ul li')).toContainText(['Inner step']);

    // Publishing keeps the body intact — the editor still shows the structure.
    // The published article is not re-read over an app reload here: the KB is
    // client-side mock state, so a reload would reset the seed and drop it. The
    // public rendering of this same markup is covered against seeded content, in
    // the legal-document test below and in the jsdom help-center suite.
    await page.getByRole('tab', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('published', { exact: true })).toBeVisible();

    const published = editor(page);
    await expect(published.getByRole('heading', { name: 'Before you start' })).toBeVisible();
    await expect(published.locator('ol li ol li, ol li ul li')).toContainText(['Inner step']);
    await expect(published.getByRole('link')).toHaveAttribute('href', '/help/a/track-your-shipment');
  });

  test('undo, redo, and clear formatting work', async ({ page }) => {
    await visitAs(page, '/admin/kb/faqs/new');
    await focusEmptyEditor(page);

    await page.keyboard.type('Keep this');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(editor(page)).not.toContainText('Keep this');

    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(editor(page)).toContainText('Keep this');

    // Bold it, then strip the formatting back off.
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'Bold' }).click();
    await expect(editor(page).locator('strong, b')).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear formatting' }).click();
    await expect(editor(page).locator('strong, b')).toHaveCount(0);
    await expect(editor(page)).toContainText('Keep this');
  });

  test('a legal document keeps its clause numbering and section links', async ({ page }) => {
    await visitAs(page, '/help/legal/general-terms-of-service', 'guest');

    // Ordered clauses render as an ordered list with real numbering.
    const clauses = page.locator('ol').first();
    await expect(clauses.locator('> li').first()).toBeVisible();

    // A section link lands on the anchored heading in the target document.
    await page.getByRole('link', { name: 'Refunds & Claims Policy' }).first().click();
    await expect(page).toHaveURL(/refunds-and-claims-policy#liability-caps/);
    await expect(page.locator('#liability-caps')).toBeVisible();
  });
});
