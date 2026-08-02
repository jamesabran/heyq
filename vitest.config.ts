import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Kept separate from vite.config.ts: Vitest resolves its own bundled Vite, so
// pairing test settings here (without the app build plugins) avoids a Vite
// version/type clash while the app build stays clean.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Order matters: the AI isolation must neutralize the environment BEFORE
    // setup.ts imports the server (and with it seed.ts, which reads the
    // environment at import time). See src/test/aiTransportIsolation.ts.
    setupFiles: ['./src/test/aiTransportIsolation.ts', './src/test/setup.ts'],
    css: true,
    // e2e/ is Playwright's; it needs a real browser, not jsdom.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
  },
});
