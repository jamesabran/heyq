import { describe, expect, it } from 'vitest';
import {
  extractSections,
  isRichText,
  legacyToRichText,
  richTextExcerpt,
  richTextToPlainText,
  sanitizeRichText,
  toRichText,
  withHeadingAnchors,
} from './richText';

describe('sanitizeRichText', () => {
  it('keeps the formatting the editor produces', () => {
    const html =
      '<h2>Refunds</h2><p><strong>Bold</strong> and <em>italic</em> and <u>underline</u>.</p>' +
      '<ol><li>First</li><li>Second<ul><li>Nested</li></ul></li></ol>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('preserves nested list structure and indentation', () => {
    const html = '<ul><li>Top<ol><li>Inner<ul><li>Deepest</li></ul></li></ol></li></ul>';
    const out = sanitizeRichText(html);
    expect(out).toBe(html);
    expect(sanitizeRichText('<blockquote><p>Indented</p></blockquote>')).toBe(
      '<blockquote><p>Indented</p></blockquote>',
    );
  });

  it('normalises presentational tags to semantic ones', () => {
    expect(sanitizeRichText('<b>a</b><i>b</i><div>c</div><h1>d</h1>')).toBe(
      '<strong>a</strong><em>b</em><p>c</p><h2>d</h2>',
    );
  });

  it('removes scripts and event handlers without leaking their contents', () => {
    const out = sanitizeRichText('<p onclick="steal()">Hi</p><script>alert(1)</script>');
    expect(out).toBe('<p>Hi</p>');
    expect(out).not.toContain('alert');
    expect(out).not.toContain('onclick');
  });

  it('strips inline styles and classes', () => {
    expect(sanitizeRichText('<p style="color:red" class="x">Hi</p>')).toBe('<p>Hi</p>');
  });

  it('drops unsafe link schemes but keeps the link text', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">Click</a>')).toBe('Click');
    expect(sanitizeRichText('<a href="data:text/html,<b>x</b>">Click</a>')).toBe('Click');
  });

  it('keeps safe external links and hardens them', () => {
    const out = sanitizeRichText('<a href="https://example.com/tos">Terms</a>');
    expect(out).toContain('href="https://example.com/tos"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
  });

  it('keeps internal KB links and section anchors without target', () => {
    const article = sanitizeRichText('<a href="/help/a/track-your-shipment">Tracking</a>');
    expect(article).toBe('<a href="/help/a/track-your-shipment">Tracking</a>');

    const section = sanitizeRichText('<a href="/help/legal/privacy-annex#data-we-collect">Data</a>');
    expect(section).toBe('<a href="/help/legal/privacy-annex#data-we-collect">Data</a>');

    expect(sanitizeRichText('<a href="#liability">Liability</a>')).toBe('<a href="#liability">Liability</a>');
  });

  it('rejects in-app links outside the knowledge base', () => {
    expect(sanitizeRichText('<a href="/admin/kb/secret">x</a>')).toBe('x');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeRichText('')).toBe('');
    expect(sanitizeRichText('   ')).toBe('');
  });
});

describe('legacy body migration', () => {
  const legacy = `Booking takes a minute.

## Steps
- Open the app and tap **Book**.
- Confirm the price.`;

  it('maps the legacy convention onto rich text', () => {
    const out = legacyToRichText(legacy);
    expect(out).toContain('<p>Booking takes a minute.</p>');
    expect(out).toContain('<h2>Steps</h2>');
    expect(out).toContain('<li>Open the app and tap <strong>Book</strong>.</li>');
  });

  it('escapes HTML hiding in a legacy body', () => {
    expect(legacyToRichText('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });

  it('detects which convention a body uses', () => {
    expect(isRichText('<p>Hi</p>')).toBe(true);
    expect(isRichText('## Heading')).toBe(false);
  });

  it('toRichText routes each body to the right path', () => {
    expect(toRichText('<p>Already rich</p>')).toBe('<p>Already rich</p>');
    expect(toRichText('## Legacy')).toBe('<h2>Legacy</h2>');
    expect(toRichText('')).toBe('');
  });
});

describe('plain text and sections', () => {
  it('separates blocks when flattening to plain text', () => {
    expect(richTextToPlainText('<li>alpha</li><li>beta</li>')).toBe('alpha beta');
  });

  it('does not leak tag names into searchable text', () => {
    expect(richTextToPlainText('<p><strong>Refunds</strong></p>')).toBe('Refunds');
  });

  it('extracts headings with anchors matching the rendered ids', () => {
    const html = '<h2>Data we collect</h2><p>x</p><h3>Retention</h3>';
    expect(extractSections(html)).toEqual([
      { id: 'data-we-collect', text: 'Data we collect', level: 2 },
      { id: 'retention', text: 'Retention', level: 3 },
    ]);
    expect(withHeadingAnchors(html)).toContain('<h2 id="data-we-collect">Data we collect</h2>');
  });

  it('de-duplicates repeated headings so every anchor resolves', () => {
    const html = '<h2>Scope</h2><h2>Scope</h2>';
    expect(extractSections(html).map((s) => s.id)).toEqual(['scope', 'scope-2']);
    expect(withHeadingAnchors(html)).toBe('<h2 id="scope">Scope</h2><h2 id="scope-2">Scope</h2>');
  });

  it('truncates an excerpt on a word boundary', () => {
    expect(richTextExcerpt('<p>alpha beta gamma delta</p>', 12)).toBe('alpha beta…');
    expect(richTextExcerpt('<p>short</p>', 100)).toBe('short');
  });
});

describe('list normalisation', () => {
  it('re-homes a browser-emitted nested list onto its list item', () => {
    // What execCommand('indent') produces: a list directly inside a list.
    expect(sanitizeRichText('<ul><li>Top</li><ul><li>Nested</li></ul></ul>')).toBe(
      '<ul><li>Top<ul><li>Nested</li></ul></li></ul>',
    );
  });

  it('keeps ordered nesting attached so numbering stays predictable', () => {
    expect(sanitizeRichText('<ol><li>One</li><ol><li>One A</li></ol><li>Two</li></ol>')).toBe(
      '<ol><li>One<ol><li>One A</li></ol></li><li>Two</li></ol>',
    );
  });

  it('synthesises an item when a nested list has nothing to attach to', () => {
    expect(sanitizeRichText('<ul><ul><li>Orphan</li></ul></ul>')).toBe(
      '<ul><li><ul><li>Orphan</li></ul></li></ul>',
    );
  });

  it('unwraps a list the browser left inside a paragraph', () => {
    // `<p><ol>` is invalid; HTML parsing closes the paragraph before the list.
    expect(sanitizeRichText('<p><ol><li>Item</li></ol></p>')).toContain('<ol><li>Item</li></ol>');
  });

  it('leaves already-correct nesting untouched', () => {
    const good = '<ul><li>Top<ol><li>Inner</li></ol></li></ul>';
    expect(sanitizeRichText(good)).toBe(good);
  });
});
