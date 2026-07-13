import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tokens = JSON.parse(readFileSync(resolve(root, 'tokens/tokens.json'), 'utf8'));
const theme = readFileSync(resolve(root, 'src/styles/theme.css'), 'utf8');

describe('design tokens', () => {
  it('keeps light and dark color sets in sync', () => {
    const light = Object.keys(tokens.color.light).sort();
    const dark = Object.keys(tokens.color.dark).sort();
    expect(dark).toEqual(light);
  });

  it('keeps brand red distinct from destructive red in both themes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const { primary, destructive } = tokens.color[mode];
      expect(primary.toLowerCase()).not.toEqual(destructive.toLowerCase());
    }
    expect(tokens.color.light.destructive.toLowerCase()).toBe('#d4183d');
  });

  it('has a generated theme.css with both :root and .dark blocks', () => {
    expect(theme).toMatch(/:root\s*\{/);
    expect(theme).toMatch(/\.dark\s*\{/);
    expect(theme).toContain('--primary:');
  });
});
