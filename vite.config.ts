import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 18020,
    strictPort: true,
    proxy: {
      // The HeyQ mock API server (M23/M24) — run separately via `npm run server`.
      '/api': `http://localhost:${Number(process.env.HEYQ_API_PORT) || 4310}`,
    },
  },
});
