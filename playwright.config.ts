import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal browser smoke coverage — a proxy for the manual QA pass, not a
 * replacement for it. It answers three questions the jsdom suite cannot:
 *   1. does the page render in a real browser with no console/page errors?
 *   2. do the critical labels, counters, tables, and actions actually appear?
 *   3. does the layout survive desktop AND mobile widths without the *page*
 *      scrolling sideways (tables may scroll inside their own box)?
 *
 * Screenshots land in e2e/screenshots/ for a human to review later. Deliberately
 * no pixel-perfect / visual-diff assertions: those are brittle and would fail on
 * every legitimate copy change.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://localhost:18020',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:18020',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
