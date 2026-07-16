/**
 * richText — the safety and normalisation seam for Knowledge Base bodies.
 *
 * KB article and legal-document bodies are stored as a restricted subset of
 * HTML. Nothing renders or persists without passing through `sanitizeRichText`,
 * so a body is never trusted: scripts, event handlers, inline styles, and unsafe
 * URL schemes are removed rather than escaped, and the surviving markup is
 * normalised to a small, predictable tag set the editor and renderer agree on.
 *
 * Bodies authored under the old plain-text convention (`## heading`, `- item`,
 * `**bold**`) still exist in seed data, so `toRichText` maps them forward on the
 * fly. That keeps legacy content readable without duplicating it into a second
 * field (docs/product-rules.md #5).
 */

/** Tags kept as-is. Everything structural the editor can produce lives here. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's',
  'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'a', 'blockquote',
]);

/**
 * Tags removed with their subtree. Unwrapping these would leak their contents
 * (script source, style rules) into the document as visible text.
 */
const DROPPED_SUBTREES = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'link', 'meta',
  'noscript', 'template', 'svg', 'math', 'form', 'input', 'button',
]);

/**
 * Presentational tags rewritten to their semantic equivalent. `document.execCommand`
 * still emits `<b>`/`<i>`/`<div>`, and pasted content brings `<h1>`/`<h5>` — mapping
 * them here means the renderer only ever sees the allowed set.
 */
const TAG_ALIASES: Record<string, string> = {
  b: 'strong',
  i: 'em',
  strike: 's',
  del: 's',
  div: 'p',
  h1: 'h2',
  h5: 'h4',
  h6: 'h4',
};

/** URL schemes safe to keep on a link. Anything else (javascript:, data:) is dropped. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:'];

/** In-app destinations an internal KB link may point at. */
const INTERNAL_PREFIXES = ['/help/a/', '/help/c/', '/help/legal', '/help'];

export interface RichTextSection {
  /** Anchor id, unique within the document. */
  id: string;
  text: string;
  /** 2, 3, or 4 — matches the heading level. */
  level: number;
}

/**
 * Strip a body down to the allowed subset.
 *
 * Disallowed-but-harmless elements are unwrapped (children survive) so pasted
 * content keeps its text; `DROPPED_SUBTREES` elements are removed outright.
 * Returns '' for empty input.
 */
export function sanitizeRichText(html: string): string {
  if (!html || !html.trim()) return '';

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  sanitizeChildren(doc.body);
  normaliseLists(doc.body);
  return doc.body.innerHTML.trim();
}

/**
 * Re-home nested lists onto a list item.
 *
 * Browsers emit `<ul><ul>…</ul></ul>` when a list is indented — a list directly
 * inside a list, with no `<li>` between. That is invalid HTML, and it renders
 * inconsistently: the nested level detaches from the item it belongs to and
 * ordered numbering restarts unpredictably. Moving each stray list into the
 * preceding `<li>` produces the `li > ul` shape the renderer's nesting styles
 * (and readers) expect.
 */
function normaliseLists(root: Element): void {
  let moved = true;
  // One pass can create newly-stray lists a level up, so repeat until stable.
  while (moved) {
    moved = false;
    for (const list of Array.from(root.querySelectorAll('ul, ol'))) {
      const parent = list.parentElement;
      if (!parent) continue;
      const parentTag = parent.tagName.toLowerCase();
      if (parentTag !== 'ul' && parentTag !== 'ol') continue;

      let host = list.previousElementSibling;
      if (!host || host.tagName.toLowerCase() !== 'li') {
        // No item to attach to — synthesise one so the level still nests.
        host = root.ownerDocument.createElement('li');
        parent.insertBefore(host, list);
      }
      host.appendChild(list);
      moved = true;
    }
  }
}

function sanitizeChildren(parent: Element): void {
  // Snapshot first: sanitising mutates the live child list as nodes unwrap.
  for (const child of Array.from(parent.childNodes)) {
    if (child.nodeType === 3 /* text */) continue;
    if (child.nodeType !== 1 /* element */) {
      child.remove();
      continue;
    }

    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (DROPPED_SUBTREES.has(tag)) {
      el.remove();
      continue;
    }

    sanitizeChildren(el);

    const mapped = TAG_ALIASES[tag] ?? tag;
    if (!ALLOWED_TAGS.has(mapped)) {
      unwrap(el);
      continue;
    }

    const kept = mapped === tag ? el : rename(el, mapped);
    scrubAttributes(kept);
  }
}

/** Replace an element with its children, preserving document order. */
function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  el.remove();
}

/** Swap an element's tag while keeping its children. Attributes are scrubbed after. */
function rename(el: Element, tag: string): Element {
  const replacement = el.ownerDocument.createElement(tag);
  while (el.firstChild) replacement.appendChild(el.firstChild);
  el.replaceWith(replacement);
  return replacement;
}

/**
 * Remove every attribute except a validated `href` on a link. Dropping the whole
 * attribute surface (not just `on*`) means a new unsafe attribute can't slip
 * through as browsers add them.
 */
function scrubAttributes(el: Element): void {
  const tag = el.tagName.toLowerCase();
  const href = tag === 'a' ? el.getAttribute('href') : null;

  for (const name of Array.from(el.attributes).map((a) => a.name)) {
    el.removeAttribute(name);
  }

  if (tag !== 'a') return;

  const safe = href ? safeHref(href) : null;
  if (!safe) {
    // A link with nowhere safe to go is just text.
    unwrap(el);
    return;
  }

  el.setAttribute('href', safe);
  if (isExternalHref(safe)) {
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener noreferrer nofollow');
  }
}

/** Normalise an href, or return null when it isn't a destination we allow. */
function safeHref(raw: string): string | null {
  const href = raw.trim();
  if (!href) return null;

  // Same-document section link.
  if (href.startsWith('#')) return href.length > 1 ? href : null;

  // In-app link (possibly with a #section suffix).
  if (href.startsWith('/')) {
    return INTERNAL_PREFIXES.some((p) => href.startsWith(p)) ? href : null;
  }

  try {
    const url = new URL(href);
    return SAFE_SCHEMES.includes(url.protocol) ? url.href : null;
  } catch {
    // Not parseable as absolute and not rooted — reject rather than guess.
    return null;
  }
}

/** True for links that leave the app and therefore need target/rel hardening. */
export function isExternalHref(href: string): boolean {
  return !href.startsWith('#') && !href.startsWith('/');
}

/** True when a body is already rich text rather than the legacy convention. */
export function isRichText(body: string): boolean {
  return /<(p|h2|h3|h4|ul|ol|li|strong|em|u|a|blockquote|br)\b[^>]*>/i.test(body);
}

/**
 * Convert a legacy body (`## heading`, `- item`, `**bold**`, blank-line
 * paragraphs) to rich text. Nested legacy lists were never expressible, so a
 * single level is all this needs to produce.
 *
 * Parsing is line-oriented rather than block-oriented: legacy bodies routinely
 * put a `## heading` and its `- items` in one blank-line-delimited block, which
 * a block parser would fold into a single run-on heading.
 */
export function legacyToRichText(body: string): string {
  const out: string[] = [];
  let listItems: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (listItems.length) out.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inlineToHtml(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushAll = () => {
    flushList();
    flushParagraph();
  };

  for (const raw of body.split('\n')) {
    const line = raw.trim();

    if (!line) {
      flushAll();
    } else if (line.startsWith('## ')) {
      flushAll();
      out.push(`<h2>${inlineToHtml(line.slice(3).trim())}</h2>`);
    } else if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(`<li>${inlineToHtml(line.slice(2))}</li>`);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushAll();

  return sanitizeRichText(out.join(''));
}

/** Escape text and promote `**bold**` runs, mirroring the legacy renderer. */
function inlineToHtml(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * The one call every reader should use: sanitized rich text, whether the body
 * was authored as rich text or under the legacy convention.
 */
export function toRichText(body: string): string {
  if (!body || !body.trim()) return '';
  return isRichText(body) ? sanitizeRichText(body) : legacyToRichText(body);
}

/** Plain text for search indexing, excerpts, and length checks. */
export function richTextToPlainText(html: string): string {
  if (!html || !html.trim()) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  // Block boundaries become spaces so `<li>a</li><li>b</li>` doesn't read as "ab".
  doc.body.querySelectorAll('p, h2, h3, h4, li, br, blockquote').forEach((el) => {
    el.appendChild(doc.createTextNode(' '));
  });
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Headings in document order, with anchor ids matching `withHeadingAnchors`.
 * Powers the legal-document table of contents and cross-document section links.
 */
export function extractSections(html: string): RichTextSection[] {
  const doc = new DOMParser().parseFromString(`<body>${toRichText(html)}</body>`, 'text/html');
  const used = new Map<string, number>();

  return Array.from(doc.body.querySelectorAll('h2, h3, h4')).map((el) => {
    const text = (el.textContent ?? '').trim();
    return {
      id: uniqueAnchor(text, used),
      text,
      level: Number(el.tagName.slice(1)),
    };
  });
}

/**
 * Add stable anchor ids to headings so `#section` links resolve. Ids are derived
 * from heading text (readable, survives reordering) and de-duplicated by suffix.
 */
export function withHeadingAnchors(html: string): string {
  const rich = toRichText(html);
  if (!rich) return '';

  const doc = new DOMParser().parseFromString(`<body>${rich}</body>`, 'text/html');
  const used = new Map<string, number>();

  doc.body.querySelectorAll('h2, h3, h4').forEach((el) => {
    el.setAttribute('id', uniqueAnchor((el.textContent ?? '').trim(), used));
  });

  return doc.body.innerHTML.trim();
}

/** Slugify heading text, appending -2, -3, … when a document repeats a heading. */
function uniqueAnchor(text: string, used: Map<string, number>): string {
  const base = slugifyAnchor(text);
  const seen = used.get(base) ?? 0;
  used.set(base, seen + 1);
  return seen === 0 ? base : `${base}-${seen + 1}`;
}

export function slugifyAnchor(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/** First `limit` characters of the body as plain text — used to seed excerpts. */
export function richTextExcerpt(html: string, limit = 160): string {
  const text = richTextToPlainText(html);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`;
}
