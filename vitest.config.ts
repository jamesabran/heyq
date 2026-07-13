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
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
