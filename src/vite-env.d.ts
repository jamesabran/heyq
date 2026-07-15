/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the standalone HeyQ API in production (e.g.
   * `https://heyq-api.up.railway.app`). Consumed by `src/app/lib/apiClient.ts`
   * to build `${VITE_API_BASE_URL}/api/...`. Leave unset locally so the vite
   * dev proxy serves same-origin `/api` requests.
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
