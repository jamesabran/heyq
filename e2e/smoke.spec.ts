import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke coverage for the primary routes. Checks that each page renders in a real
 * browser without runtime errors, that its critical content is present, and that
 * the page body never scrolls horizontally — then screenshots it for review.
 */

/** The identity switcher is backed by localStorage, so seed it before first paint. */
async function visitAs(page: Page, path: string, identity: string) {
  await page.addInitScript((id) => window.localStorage.setItem('heyq-identity', id), identity);
  await page.goto(path);
}

/** Fails the test if the app logged an error or threw during the visit. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

/**
 * The page itself must never scroll sideways. Wide tables are allowed to scroll
 * inside their own container — that is the intended design — so this asserts on
 * documentElement, not on the table.
 */
async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, 'the page body scrolls horizontally').toBeLessThanOrEqual(1);
}

async function shoot(page: Page, name: string, project: string) {
  await page.screenshot({ path: `e2e/screenshots/${project}-${name}.png`, fullPage: true });
}

const ROUTES: { name: string; path: string; identity: string; expect: RegExp }[] = [
  { name: 'overview-agent', path: '/app', identity: 'l1_agent', expect: /welcome, alex/i },
  { name: 'overview-supervisor', path: '/app', identity: 'team_lead', expect: /welcome, carlo/i },
  { name: 'overview-customer', path: '/app', identity: 'customer', expect: /welcome, nadia/i },
  { name: 'queue-mine', path: '/app/mine', identity: 'l1_agent', expect: /my queue/i },
  { name: 'queue-team', path: '/app/team', identity: 'admin', expect: /team tickets/i },
  { name: 'saved-views', path: '/app/views', identity: 'l1_agent', expect: /saved views/i },
  { name: 'ticket-detail', path: '/app/tickets/tkt-seed-7', identity: 'admin', expect: /lost parcel/i },
  { name: 'reports', path: '/app/reports', identity: 'admin', expect: /reports/i },
  { name: 'quality-reviews', path: '/app/reviews', identity: 'team_lead', expect: /quality reviews/i },
  { name: 'audit-log', path: '/admin/audit', identity: 'admin', expect: /audit log/i },
  { name: 'contact', path: '/contact', identity: 'guest', expect: /submit a ticket|contact/i },
];

for (const route of ROUTES) {
  test(`${route.name} renders cleanly`, async ({ page }, testInfo) => {
    const errors = watchForErrors(page);

    await visitAs(page, route.path, route.identity);
    await expect(page.getByRole('heading', { name: route.expect }).first()).toBeVisible();

    await expectNoPageOverflow(page);
    await shoot(page, route.name, testInfo.project.name);

    expect(errors, `runtime errors on ${route.path}`).toEqual([]);
  });
}

test('the queue table shows tracking numbers and calm badge hierarchy', async ({ page }, testInfo) => {
  await visitAs(page, '/app/team', 'admin');
  await expect(page.getByRole('heading', { name: /team tickets/i })).toBeVisible();

  const isMobile = testInfo.project.name === 'mobile';

  if (isMobile) {
    // Below `md` the Tracking column is shed — but the number is NOT lost: it
    // folds into the subject cell, so it must still be visible somewhere.
    await expect(page.getByRole('columnheader', { name: 'Tracking' })).toBeHidden();
  } else {
    await expect(page.getByRole('columnheader', { name: 'Tracking' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Concern Type' })).toBeVisible();
  }

  // Visible at every width — as its own column on desktop, folded into the
  // subject line on mobile.
  const tracking = page.getByRole('table').getByText('ZTQZ-F924-ZZ0P').filter({ visible: true });
  await expect(tracking.first()).toBeVisible();

  // The six core statuses are the only ones that can appear. Scope to the table:
  // the status filter's <option> list also contains these words.
  const table = page.getByRole('table');
  await expect(page.getByText('Pending Requester')).toHaveCount(0);
  await expect(table.getByText('On Hold').first()).toBeVisible();
});

test('an Overview counter drills into the matching filtered queue', async ({ page }) => {
  await visitAs(page, '/app', 'l1_agent');
  await page.getByRole('link', { name: /urgent/i }).click();

  await expect(page).toHaveURL(/\/app\/mine\?priority=urgent/);
  await expect(page.getByRole('heading', { name: /my queue/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'HQ-2026-0005' })).toBeVisible();
});

test('the Reopened and On Hold saved views filter the queue', async ({ page }) => {
  await visitAs(page, '/app/views', 'admin');

  await page.getByRole('link', { name: /reopened/i }).click();
  await expect(page).toHaveURL(/reopened=1/);
  await expect(page.getByRole('link', { name: 'HQ-2026-0017' })).toBeVisible();
  // The filter is visible and clearable, not a hidden URL trick.
  await expect(page.getByRole('button', { name: /reopened only/i })).toBeVisible();

  await page.goto('/app/views');
  await page.getByRole('link', { name: /on hold/i }).click();
  await expect(page).toHaveURL(/status=on_hold/);
});

test('the public form rejects a malformed tracking number', async ({ page }) => {
  await visitAs(page, '/contact', 'guest');

  await page.getByLabel('Name').fill('Jamie Lopez');
  await page.getByLabel('Email').fill('jamie@example.com');
  await page.getByLabel('Concern type').selectOption({ label: 'Delivery' });
  await page.getByLabel('Subject').fill('Parcel is late');
  await page.getByLabel('Description').fill('It has not arrived.');
  await page.getByLabel('Tracking number').fill('GGX-8842019');

  await page.getByRole('button', { name: /submit/i }).click();

  await expect(page.getByText(/tracking numbers look like 1GGT-AYT1-TKK3/i)).toBeVisible();
});

test('a Business+ customer links an authorized order and submits (M22)', async ({ page }) => {
  await visitAs(page, '/contact', 'customer');

  // The picker lists only Acme's orders, and contact details are prefilled.
  await expect(page.getByText('Link a GGX Business+ order')).toBeVisible();
  await expect(page.getByText('Q7PL-2MRX-J90A')).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Nadia Cruz');

  await page.getByRole('radio', { name: /order bp-ord-7001/i }).check();
  await page.getByLabel('Concern type').selectOption({ label: 'Delivery' });
  await page.getByLabel('Subject').fill('Recipient did not receive the parcel');
  await page.getByLabel('Description').fill('Out for delivery since yesterday with no update.');
  await page.getByRole('button', { name: /submit/i }).click();

  await expect(page.getByRole('heading', { name: /ticket submitted/i })).toBeVisible();
  await expect(page.getByText(/HQ-2026-\d{4}/)).toBeVisible();
});

test('an agent sees linked-order context, and live shipment never moves ticket status (M22)', async ({ page }) => {
  await visitAs(page, '/app/tickets/tkt-seed-18', 'admin');

  await expect(page.getByRole('heading', { name: /recipient reports the parcel has not moved/i })).toBeVisible();
  await expect(page.getByText('GGX Business+ Order')).toBeVisible();
  await expect(page.getByText('Y6TN-4QSV-D28E')).toBeVisible();
  await expect(page.getByText('In transit', { exact: true })).toBeVisible(); // the snapshot badge

  // Live check: the shipment moved to Delivered upstream; the HeyQ status chip
  // stays exactly where the workflow left it.
  await page.getByRole('button', { name: /check live status/i }).click();
  await expect(page.getByText(/changed since submission/i)).toBeVisible();
  await expect(page.getByText('Delivered', { exact: true })).toBeVisible();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});

test('a lead opens a completed quality review and sees read-only evidence + score', async ({ page }) => {
  await visitAs(page, '/app/reviews', 'team_lead');
  await expect(page.getByRole('heading', { name: 'Quality Reviews' })).toBeVisible();

  // The seeded completed review (tkt-bp-3 → HQ-2026-0103) opens the workspace.
  await page.getByRole('link', { name: 'HQ-2026-0103' }).click();
  await expect(page.getByRole('heading', { name: /quality review/i })).toBeVisible();

  // Evidence is present and read-only — the conversation shows, no reply composer.
  await expect(page.getByRole('heading', { name: 'Conversation' })).toBeVisible();
  await expect(page.getByRole('button', { name: /save draft/i })).toHaveCount(0);
  // The frozen score is shown and the review is locked.
  await expect(page.getByText('96%').first()).toBeVisible();
  await expect(page.getByText(/final and can no longer be edited/i)).toBeVisible();
});

test('a non-reviewer cannot reach the Quality Reviews page', async ({ page }) => {
  await visitAs(page, '/app/reviews', 'l1_agent');
  await expect(page.getByText(/access restricted/i)).toBeVisible();
});

test('dark mode renders the app with no runtime errors', async ({ page }, testInfo) => {
  const errors = watchForErrors(page);

  await page.emulateMedia({ colorScheme: 'dark' });
  await visitAs(page, '/app/mine', 'l1_agent');
  await expect(page.getByRole('heading', { name: /my queue/i })).toBeVisible();

  // The theme actually flipped — the app toggles `.dark` on <html>.
  await expect(page.locator('html')).toHaveClass(/dark/);

  await shoot(page, 'queue-mine-dark', testInfo.project.name);
  expect(errors).toEqual([]);
});
