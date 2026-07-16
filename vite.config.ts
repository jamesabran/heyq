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
      // `ws: true` so the realtime WebSocket upgrade at /api/realtime is proxied
      // to the Node server in local dev (same-origin), matching the REST proxy.
      '/api': {
        target: `http://localhost:${Number(process.env.HEYQ_API_PORT) || 4310}`,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
