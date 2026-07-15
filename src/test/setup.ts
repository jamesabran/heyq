import '@testing-library/jest-dom/vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createHeyQServer } from '../../server/http.ts';

// M23/M24 — HeyQ's mock API server now owns ticket/notification/order-provider
// state; services talk to it over HTTP (src/app/lib/apiClient.ts). Vitest
// isolates modules PER TEST FILE by default, so a server started once for the
// whole run (e.g. in `globalSetup`) would live in a different module registry
// than this file's own `data/catalog.ts` import — adminService mutations
// (routing team, SLA targets, agent active state) would then silently fail to
// reach the server. Starting a fresh server HERE, inside this file's own
// setupFiles context, keeps them the same module instance, exactly like
// before the migration.
let heyqTestServer: Server;

beforeAll(async () => {
  heyqTestServer = createHeyQServer();
  await new Promise<void>((resolve) => heyqTestServer.listen(0, resolve));
  const { port } = heyqTestServer.address() as AddressInfo;
  process.env.HEYQ_TEST_API_PORT = String(port);
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) => {
      heyqTestServer.close((err) => (err ? reject(err) : resolve()));
    }),
);

// jsdom lacks matchMedia; provide a light-preference default so ThemeProvider
// can resolve an initial theme.
beforeEach(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});
