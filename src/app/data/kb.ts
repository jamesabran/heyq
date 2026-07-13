// Mock KB seed data (module state). Components must NOT import this directly —
// access it through services/kbService.ts. Includes one internal and one draft
// article so public-visibility filtering is demonstrable.
import type { KbArticle, KbCategory, KbRevision } from '../models/kb';

const BRAND = 'ggx';

export const kbCategories: KbCategory[] = [
  { id: 'cat-start', brandId: BRAND, parentId: null, slug: 'getting-started', name: 'Getting Started', description: 'Book your first delivery and set up your account.', icon: 'IconRocket', order: 1 },
  { id: 'cat-account', brandId: BRAND, parentId: null, slug: 'account', name: 'Account & Profile', description: 'Manage your profile, password, and settings.', icon: 'IconUser', order: 2 },
  { id: 'cat-deliveries', brandId: BRAND, parentId: null, slug: 'deliveries', name: 'Deliveries & Pickups', description: 'Booking, tracking, timelines, and pickups.', icon: 'IconTruck', order: 3 },
  { id: 'cat-sameday', brandId: BRAND, parentId: 'cat-deliveries', slug: 'same-day', name: 'Same-Day Delivery', description: 'Cutoffs and coverage for same-day.', icon: 'IconBolt', order: 1 },
  { id: 'cat-payments', brandId: BRAND, parentId: null, slug: 'payments', name: 'Payments & COD', description: 'Payment methods and cash on delivery.', icon: 'IconCash', order: 4 },
  { id: 'cat-returns', brandId: BRAND, parentId: null, slug: 'returns-claims', name: 'Returns & Claims', description: 'Return a package or file a claim.', icon: 'IconPackage', order: 5 },
  { id: 'cat-technical', brandId: BRAND, parentId: null, slug: 'technical', name: 'Technical & App', description: 'App troubleshooting and known issues.', icon: 'IconDeviceMobile', order: 6 },
];

export const kbArticles: KbArticle[] = [
  {
    id: 'art-book', brandId: BRAND, kbCategoryId: 'cat-start', slug: 'how-to-book-a-delivery',
    title: 'How to book a delivery', excerpt: 'Create a booking in a few steps, from pickup to drop-off.',
    body: `Booking a delivery with GGX takes just a minute.

## Before you start
- Make sure you have the pickup and drop-off addresses ready.
- Have the package weight and dimensions handy.

## Steps
- Open the app or web dashboard and tap **Book a delivery**.
- Enter the pickup and drop-off details.
- Choose a service level and confirm the price estimate.
- Review and place the booking — you'll get a tracking number instantly.

Once booked, you can track the shipment in real time from your dashboard.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-03-02T08:00:00Z', updatedAt: '2026-06-20T10:15:00Z',
  },
  {
    id: 'art-create-account', brandId: BRAND, kbCategoryId: 'cat-start', slug: 'create-your-ggx-account',
    title: 'Create your GGX account', excerpt: 'Sign up and verify your account to start booking.',
    body: `Creating an account lets you save addresses, track shipments, and view history.

## Steps
- Tap **Sign up** and enter your name, email, and mobile number.
- Verify your mobile number with the code we send you.
- Add your first pickup address to finish setup.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-05T08:00:00Z', updatedAt: '2026-05-11T09:00:00Z',
  },
  {
    id: 'art-reset-password', brandId: BRAND, kbCategoryId: 'cat-account', slug: 'reset-your-password',
    title: 'Reset your password', excerpt: 'Regain access to your account if you forgot your password.',
    body: `If you can't sign in, you can reset your password.

## Steps
- On the sign-in screen, tap **Forgot password**.
- Enter the email on your account.
- Open the reset link we email you and choose a new password.

For security, reset links expire after a short time.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-02-18T08:00:00Z', updatedAt: '2026-06-30T14:00:00Z',
  },
  {
    id: 'art-update-profile', brandId: BRAND, kbCategoryId: 'cat-account', slug: 'update-your-profile',
    title: 'Update your profile', excerpt: 'Change your name, contact details, and saved addresses.',
    body: `Keep your profile up to date so deliveries reach the right place.

## What you can change
- Display name and contact number
- Email address (re-verification required)
- Saved pickup and drop-off addresses`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-02-20T08:00:00Z', updatedAt: '2026-04-02T11:30:00Z',
  },
  {
    id: 'art-track', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'track-your-shipment',
    title: 'Track your shipment', excerpt: 'Follow your parcel in real time from pickup to delivery.',
    body: `Every booking comes with a tracking number.

## Where to track
- In the app, open **My shipments** and select the booking.
- On the web, paste your tracking number into the tracker.

## Status meanings
- **Booked** — we've received your request.
- **In transit** — your parcel is on the way.
- **Delivered** — the parcel reached its destination.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-03-10T08:00:00Z', updatedAt: '2026-07-01T09:45:00Z',
  },
  {
    id: 'art-timelines', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'delivery-timelines',
    title: 'Delivery timelines', excerpt: 'Typical delivery windows by service level and destination.',
    body: `Delivery times depend on the service level and destination.

## Standard
- Metro: 1–2 business days
- Provincial: 3–5 business days

## Express
- Metro: same day for bookings before the cutoff`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-12T08:00:00Z', updatedAt: '2026-05-22T16:20:00Z',
  },
  {
    id: 'art-pickup', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'schedule-a-pickup',
    title: 'Schedule a pickup', excerpt: 'Arrange for a rider to collect your parcel.',
    body: `You can schedule a pickup when you book or afterward.

## Steps
- Open the booking and tap **Schedule pickup**.
- Choose a pickup window.
- Make sure your parcel is packed and labeled before the rider arrives.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 3,
    publishedAt: '2026-03-15T08:00:00Z', updatedAt: '2026-04-18T10:00:00Z',
  },
  {
    id: 'art-sameday-cutoff', brandId: BRAND, kbCategoryId: 'cat-sameday', slug: 'same-day-cutoff-times',
    title: 'Same-day cutoff times', excerpt: 'Book before the cutoff to qualify for same-day delivery.',
    body: `Same-day delivery is available in select areas.

## Cutoffs
- Book before **11:00 AM** for same-day delivery within the metro.
- Bookings after the cutoff are delivered the next business day.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-20T08:00:00Z', updatedAt: '2026-06-05T08:30:00Z',
  },
  {
    id: 'art-cod', brandId: BRAND, kbCategoryId: 'cat-payments', slug: 'cash-on-delivery-explained',
    title: 'Cash on delivery (COD) explained', excerpt: 'How COD works and when funds are remitted.',
    body: `COD lets your customer pay when the parcel is delivered.

## How it works
- Choose **COD** when booking and set the amount to collect.
- The rider collects payment on delivery.
- Collected funds are remitted to your account on the standard schedule.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-02-25T08:00:00Z', updatedAt: '2026-06-28T12:00:00Z',
  },
  {
    id: 'art-payment-methods', brandId: BRAND, kbCategoryId: 'cat-payments', slug: 'supported-payment-methods',
    title: 'Supported payment methods', excerpt: 'Cards, e-wallets, and account credit options.',
    body: `You can pay for bookings with several methods.

## Options
- Credit and debit cards
- Popular e-wallets
- Prepaid account credit`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-02-28T08:00:00Z', updatedAt: '2026-03-30T09:15:00Z',
  },
  {
    id: 'art-claim', brandId: BRAND, kbCategoryId: 'cat-returns', slug: 'file-a-claim-for-a-lost-parcel',
    title: 'File a claim for a lost parcel', excerpt: 'Start a claim if your parcel is lost or damaged.',
    body: `If a parcel is lost or damaged, you can file a claim.

## Before you file
- Have your tracking number and booking details ready.
- Take photos if the parcel was damaged.

## Steps
- Open the booking and tap **File a claim**.
- Describe what happened and attach any evidence.
- Our team reviews claims and responds with next steps.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-01T08:00:00Z', updatedAt: '2026-06-15T13:40:00Z',
  },
  {
    id: 'art-return', brandId: BRAND, kbCategoryId: 'cat-returns', slug: 'return-a-package',
    title: 'Return a package', excerpt: 'Send a package back to the original sender.',
    body: `Returns route a parcel back to the sender.

## Steps
- Open the delivered booking and tap **Return**.
- Confirm the return address and schedule a pickup.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-08T08:00:00Z', updatedAt: '2026-05-02T10:10:00Z',
  },
  {
    id: 'art-app-trouble', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'app-troubleshooting',
    title: 'App troubleshooting', excerpt: 'Fix common issues with the GGX app.',
    body: `Most app issues clear up with a few steps.

## Try these first
- Update to the latest app version.
- Restart the app and check your connection.
- Sign out and back in if data looks stale.`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-18T08:00:00Z', updatedAt: '2026-07-05T15:00:00Z',
  },
  // Internal-only — must NEVER appear in the public help center.
  {
    id: 'art-internal-runbook', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'internal-escalation-runbook',
    title: 'Internal escalation runbook', excerpt: 'Agent-only runbook for escalating incidents.',
    body: `This runbook is for support agents only and must not be shown to requesters.

## Escalation path
- L1 gathers details and attempts first-line resolution.
- L2 handles specialist cases.`,
    status: 'published', visibility: 'internal', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-22T08:00:00Z', updatedAt: '2026-06-10T09:00:00Z',
  },
  // Draft — must NEVER appear publicly until published.
  {
    id: 'art-draft-features', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'upcoming-feature-notes',
    title: 'Upcoming feature notes', excerpt: 'Draft notes about features not yet released.',
    body: `Draft placeholder for upcoming feature documentation.`,
    status: 'draft', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 3,
    publishedAt: undefined, updatedAt: '2026-07-09T11:00:00Z',
  },
];

// Revision history (snapshots captured on edit). Seeded with one prior revision.
export const kbRevisions: KbRevision[] = [
  { id: 'rev-book-1', articleId: 'art-book', editorId: 'kb_editor', title: 'How to book a delivery', body: 'Booking a delivery with GGX takes just a minute.\n\n## Steps\n- Open the app and tap Book a delivery.', createdAt: '2026-03-02T08:00:00Z' },
];
