// Generates src/styles/theme.css from tokens/tokens.json (the single source of truth).
// Run: node scripts/build-tokens.mjs   (or: npm run tokens)
//
// theme.css is a GENERATED artifact and is committed so the app builds without
// running this script. Re-run whenever tokens.json changes, then commit both.
//
// Unlike a light-only pipeline, this emits BOTH a `:root` block (light) and a
// `.dark` block (dark) from color.light / color.dark, so dark mode works via the
// `@custom-variant dark` + `.dark` class on <html>.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(resolve(root, 'tokens/tokens.json'), 'utf8'));
const outDir = resolve(root, 'src/styles');
const out = resolve(outDir, 'theme.css');

const { color, scalar, font, radius } = tokens;
const lightKeys = Object.keys(color.light);
const darkKeys = Object.keys(color.dark);

// Fail loudly if the two themes drift — a real risk once tokens are hand-edited.
const missingInDark = lightKeys.filter((k) => !darkKeys.includes(k));
const missingInLight = darkKeys.filter((k) => !lightKeys.includes(k));
if (missingInDark.length || missingInLight.length) {
  throw new Error(
    `tokens.json light/dark color sets are out of sync.\n` +
      (missingInDark.length ? `  missing in dark: ${missingInDark.join(', ')}\n` : '') +
      (missingInLight.length ? `  missing in light: ${missingInLight.join(', ')}\n` : ''),
  );
}

const rootLines = [];
for (const [k, v] of Object.entries(scalar)) rootLines.push(`  --${k}: ${v};`);
for (const [k, v] of Object.entries(color.light)) rootLines.push(`  --${k}: ${v};`);
rootLines.push(`  --radius: ${radius.base};`);

const darkLines = [];
for (const [k, v] of Object.entries(color.dark)) darkLines.push(`  --${k}: ${v};`);

const themeLines = [];
themeLines.push(`  --font-sans: ${font.sans};`);
for (const k of lightKeys) themeLines.push(`  --color-${k}: var(--${k});`);
for (const [k, v] of Object.entries(radius.css)) themeLines.push(`  --radius-${k}: ${v};`);

const css = `/* AUTO-GENERATED from tokens/tokens.json by scripts/build-tokens.mjs — do not edit by hand. */
@custom-variant dark (&:is(.dark *));

:root {
${rootLines.join('\n')}
}

.dark {
${darkLines.join('\n')}
}

@theme inline {
${themeLines.join('\n')}
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }

  html {
    font-size: var(--font-size);
  }

  body {
    @apply bg-background text-foreground;
    font-family: var(--font-sans);
  }
}
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(out, css);
console.log(`✓ Wrote ${out}`);
console.log(`  ${lightKeys.length} colors x2 themes, ${Object.keys(scalar).length} scalars, radius base ${radius.base}`);
