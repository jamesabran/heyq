// Mock KB seed data (module state). Components must NOT import this directly —
// access it through services/kbService.ts.
//
// Two content types are seeded independently: FAQ categories/articles, and legal
// documents (General TOS + annexes). FAQ seeds include one internal and one draft
// article, and the legal seeds include one draft annex, so status/visibility
// filtering is demonstrable in both.
//
// Bodies are stored as the sanitized rich-text subset (lib/richText). Any body
// still using the older `## heading` / `- item` convention is mapped forward on
// read by kbService, so legacy content needs no duplicate field.
import type { KbArticle, KbCategory, KbLegalDocument, KbRevision } from '../models/kb';

const BRAND = 'ggx';

// `order` is authored, not derived from creation time — admins rearrange these
// freely, and the numbers below are just the starting arrangement.
export const kbCategories: KbCategory[] = [
  { id: 'cat-start', brandId: BRAND, parentId: null, slug: 'getting-started', name: 'Getting Started', description: 'Book your first delivery and set up your account.', icon: 'IconRocket', order: 1 },
  { id: 'cat-account', brandId: BRAND, parentId: null, slug: 'account', name: 'Account & Profile', description: 'Manage your profile, password, and settings.', icon: 'IconUser', order: 2 },
  { id: 'cat-deliveries', brandId: BRAND, parentId: null, slug: 'deliveries', name: 'Delivery & Orders', description: 'Booking, tracking, timelines, and pickups.', icon: 'IconTruck', order: 3 },
  { id: 'cat-sameday', brandId: BRAND, parentId: 'cat-deliveries', slug: 'same-day', name: 'Same-Day Delivery', description: 'Cutoffs and coverage for same-day.', icon: 'IconBolt', order: 1 },
  { id: 'cat-payments', brandId: BRAND, parentId: null, slug: 'payments', name: 'Payments & Payouts', description: 'Payment methods, cash on delivery, and remittance.', icon: 'IconCash', order: 4 },
  { id: 'cat-returns', brandId: BRAND, parentId: null, slug: 'returns-claims', name: 'Claims & Refunds', description: 'Return a package or file a claim.', icon: 'IconPackage', order: 5 },
  { id: 'cat-rts', brandId: BRAND, parentId: null, slug: 'return-to-seller', name: 'Return to Seller', description: 'How undelivered parcels are routed back to sellers.', icon: 'IconArrowBackUp', order: 6 },
  { id: 'cat-seller-tools', brandId: BRAND, parentId: null, slug: 'seller-tools', name: 'Seller Tools', description: 'Dashboard, bulk booking, and integrations for sellers.', icon: 'IconBuildingStore', order: 7 },
  { id: 'cat-technical', brandId: BRAND, parentId: null, slug: 'technical', name: 'Technical & App', description: 'App troubleshooting and known issues.', icon: 'IconDeviceMobile', order: 8 },
];

export const kbArticles: KbArticle[] = [
  {
    id: 'art-book', brandId: BRAND, kbCategoryId: 'cat-start', slug: 'how-to-book-a-delivery',
    title: 'How to book a delivery', excerpt: 'Create a booking in a few steps, from pickup to drop-off.',
    body: `<p>Booking a delivery with GGX takes just a minute.</p><h2>Before you start</h2><ul><li>Make sure you have the pickup and drop-off addresses ready.</li><li>Have the package weight and dimensions handy.</li></ul><h2>Steps</h2><ol><li>Open the app or web dashboard and tap <strong>Book a delivery</strong>.</li><li>Enter the pickup and drop-off details.</li><li>Choose a service level and confirm the price estimate.<ul><li>Standard covers most destinations.</li><li>Express is limited to metro areas — see <a href="/help/a/same-day-cutoff-times">same-day cutoff times</a>.</li></ul></li><li>Review and place the booking — you'll get a tracking number instantly.</li></ol><p>Once booked, you can <a href="/help/a/track-your-shipment">track the shipment</a> in real time from your dashboard.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-03-02T08:00:00Z', updatedAt: '2026-06-20T10:15:00Z',
  },
  {
    id: 'art-create-account', brandId: BRAND, kbCategoryId: 'cat-start', slug: 'create-your-ggx-account',
    title: 'Create your GGX account', excerpt: 'Sign up and verify your account to start booking.',
    body: `<p>Creating an account lets you save addresses, track shipments, and view history.</p><h2>Steps</h2><ol><li>Tap <strong>Sign up</strong> and enter your name, email, and mobile number.</li><li>Verify your mobile number with the code we send you.</li><li>Add your first pickup address to finish setup.</li></ol><p>By signing up you accept our <a href="/help/legal/general-terms-of-service">Terms of Service</a>.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-05T08:00:00Z', updatedAt: '2026-05-11T09:00:00Z',
  },
  {
    id: 'art-reset-password', brandId: BRAND, kbCategoryId: 'cat-account', slug: 'reset-your-password',
    title: 'Reset your password', excerpt: 'Regain access to your account if you forgot your password.',
    body: `<p>If you can't sign in, you can reset your password.</p><h2>Steps</h2><ol><li>On the sign-in screen, tap <strong>Forgot password</strong>.</li><li>Enter the email on your account.</li><li>Open the reset link we email you and choose a new password.</li></ol><p>For security, reset links expire after a short time.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-02-18T08:00:00Z', updatedAt: '2026-06-30T14:00:00Z',
  },
  {
    id: 'art-update-profile', brandId: BRAND, kbCategoryId: 'cat-account', slug: 'update-your-profile',
    title: 'Update your profile', excerpt: 'Change your name, contact details, and saved addresses.',
    body: `<p>Keep your profile up to date so deliveries reach the right place.</p><h2>What you can change</h2><ul><li>Display name and contact number</li><li>Email address (re-verification required)</li><li>Saved pickup and drop-off addresses</li></ul><p>How we handle this information is described in our <a href="/help/legal/privacy-policy#data-we-collect">Privacy Policy</a>.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-02-20T08:00:00Z', updatedAt: '2026-04-02T11:30:00Z',
  },
  {
    id: 'art-track', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'track-your-shipment',
    title: 'Track your shipment', excerpt: 'Follow your parcel in real time from pickup to delivery.',
    body: `<p>Every booking comes with a tracking number.</p><h2>Where to track</h2><ul><li>In the app, open <strong>My shipments</strong> and select the booking.</li><li>On the web, paste your tracking number into the tracker.</li></ul><h2>Status meanings</h2><ul><li><strong>Booked</strong> — we've received your request.</li><li><strong>In transit</strong> — your parcel is on the way.</li><li><strong>Delivered</strong> — the parcel reached its destination.</li></ul>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-03-10T08:00:00Z', updatedAt: '2026-07-01T09:45:00Z',
  },
  {
    id: 'art-timelines', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'delivery-timelines',
    title: 'Delivery timelines', excerpt: 'Typical delivery windows by service level and destination.',
    body: `<p>Delivery times depend on the service level and destination.</p><h2>Standard</h2><ul><li>Metro: 1–2 business days</li><li>Provincial: 3–5 business days</li></ul><h2>Express</h2><ul><li>Metro: same day for bookings before the cutoff</li></ul>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-12T08:00:00Z', updatedAt: '2026-05-22T16:20:00Z',
  },
  {
    id: 'art-pickup', brandId: BRAND, kbCategoryId: 'cat-deliveries', slug: 'schedule-a-pickup',
    title: 'Schedule a pickup', excerpt: 'Arrange for a rider to collect your parcel.',
    body: `<p>You can schedule a pickup when you book or afterward.</p><h2>Steps</h2><ol><li>Open the booking and tap <strong>Schedule pickup</strong>.</li><li>Choose a pickup window.</li><li>Make sure your parcel is packed and labeled before the rider arrives.</li></ol>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 3,
    publishedAt: '2026-03-15T08:00:00Z', updatedAt: '2026-04-18T10:00:00Z',
  },
  {
    id: 'art-sameday-cutoff', brandId: BRAND, kbCategoryId: 'cat-sameday', slug: 'same-day-cutoff-times',
    title: 'Same-day cutoff times', excerpt: 'Book before the cutoff to qualify for same-day delivery.',
    body: `<p>Same-day delivery is available in select areas.</p><h2>Cutoffs</h2><ul><li>Book before <strong>11:00 AM</strong> for same-day delivery within the metro.</li><li>Bookings after the cutoff are delivered the next business day.</li></ul>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-20T08:00:00Z', updatedAt: '2026-06-05T08:30:00Z',
  },
  {
    id: 'art-cod', brandId: BRAND, kbCategoryId: 'cat-payments', slug: 'cash-on-delivery-explained',
    title: 'Cash on delivery (COD) explained', excerpt: 'How COD works and when funds are remitted.',
    body: `<p>COD lets your customer pay when the parcel is delivered.</p><h2>How it works</h2><ol><li>Choose <strong>COD</strong> when booking and set the amount to collect.</li><li>The rider collects payment on delivery.</li><li>Collected funds are remitted to your account on the standard schedule.</li></ol><p>Remittance timing is governed by the <a href="/help/legal/seller-terms#payouts-and-remittance">Seller Terms</a>.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: true, order: 1,
    publishedAt: '2026-02-25T08:00:00Z', updatedAt: '2026-06-28T12:00:00Z',
  },
  {
    id: 'art-payment-methods', brandId: BRAND, kbCategoryId: 'cat-payments', slug: 'supported-payment-methods',
    title: 'Supported payment methods', excerpt: 'Cards, e-wallets, and account credit options.',
    body: `<p>You can pay for bookings with several methods.</p><h2>Options</h2><ul><li>Credit and debit cards</li><li>Popular e-wallets</li><li>Prepaid account credit</li></ul>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-02-28T08:00:00Z', updatedAt: '2026-03-30T09:15:00Z',
  },
  {
    id: 'art-claim', brandId: BRAND, kbCategoryId: 'cat-returns', slug: 'file-a-claim-for-a-lost-parcel',
    title: 'File a claim for a lost parcel', excerpt: 'Start a claim if your parcel is lost or damaged.',
    body: `<p>If a parcel is lost or damaged, you can file a claim.</p><h2>Before you file</h2><ul><li>Have your tracking number and booking details ready.</li><li>Take photos if the parcel was damaged.</li></ul><h2>Steps</h2><ol><li>Open the booking and tap <strong>File a claim</strong>.</li><li>Describe what happened and attach any evidence.</li><li>Our team reviews claims and responds with next steps.</li></ol><p>Claim windows and liability caps are set out in the <a href="/help/legal/refunds-and-claims-policy#claim-windows">Refunds &amp; Claims Policy</a>.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-01T08:00:00Z', updatedAt: '2026-06-15T13:40:00Z',
  },
  {
    id: 'art-return', brandId: BRAND, kbCategoryId: 'cat-returns', slug: 'return-a-package',
    title: 'Return a package', excerpt: 'Send a package back to the original sender.',
    body: `<p>Returns route a parcel back to the sender.</p><h2>Steps</h2><ol><li>Open the delivered booking and tap <strong>Return</strong>.</li><li>Confirm the return address and schedule a pickup.</li></ol>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-08T08:00:00Z', updatedAt: '2026-05-02T10:10:00Z',
  },
  {
    id: 'art-rts-why', brandId: BRAND, kbCategoryId: 'cat-rts', slug: 'why-a-parcel-is-returned-to-seller',
    title: 'Why a parcel is returned to seller', excerpt: 'The reasons a parcel is routed back instead of delivered.',
    body: `<p>A parcel becomes <strong>Return to Seller</strong> (RTS) when we can't complete delivery.</p><h2>Common reasons</h2><ul><li>Three failed delivery attempts</li><li>The recipient refused the parcel</li><li>The address was incomplete or unreachable</li><li>COD payment was declined on arrival</li></ul><p>You are notified at each failed attempt before the parcel is marked RTS.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-04-02T08:00:00Z', updatedAt: '2026-06-22T09:20:00Z',
  },
  {
    id: 'art-rts-timeline', brandId: BRAND, kbCategoryId: 'cat-rts', slug: 'return-to-seller-timelines-and-fees',
    title: 'Return to seller timelines and fees', excerpt: 'How long an RTS takes and what it costs.',
    body: `<p>RTS parcels are consolidated before they travel back, so they move on a slower schedule than an outbound delivery.</p><h2>Timelines</h2><ul><li>Metro: 3–5 business days from the RTS mark</li><li>Provincial: 7–10 business days from the RTS mark</li></ul><h2>Fees</h2><ul><li>The return leg is charged at the standard rate for the lane.</li><li>The original delivery fee is not refunded.</li></ul><p>Fee schedules are defined in the <a href="/help/legal/seller-terms#fees-and-surcharges">Seller Terms</a>.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-04-05T08:00:00Z', updatedAt: '2026-07-02T11:05:00Z',
  },
  {
    id: 'art-seller-dashboard', brandId: BRAND, kbCategoryId: 'cat-seller-tools', slug: 'using-the-seller-dashboard',
    title: 'Using the seller dashboard', excerpt: 'Track shipments, payouts, and performance in one place.',
    body: `<p>The seller dashboard is where you manage everything after a booking is placed.</p><h2>What you can do</h2><ul><li>Monitor every shipment and its current status</li><li>Review COD collections and upcoming payouts</li><li>Export a shipment report for a date range</li></ul>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-04-10T08:00:00Z', updatedAt: '2026-06-18T14:30:00Z',
  },
  {
    id: 'art-bulk-booking', brandId: BRAND, kbCategoryId: 'cat-seller-tools', slug: 'bulk-booking-with-a-csv-upload',
    title: 'Bulk booking with a CSV upload', excerpt: 'Create many bookings at once from a spreadsheet.',
    body: `<p>Bulk booking creates one shipment per row of a CSV file.</p><h2>Steps</h2><ol><li>Download the template from <strong>Seller tools → Bulk booking</strong>.</li><li>Fill in one row per parcel.<ul><li>Addresses must include a contact number.</li><li>Leave the COD column blank for prepaid parcels.</li></ul></li><li>Upload the file and review the validation summary.</li><li>Confirm to create the bookings.</li></ol><p>Rows that fail validation are skipped — the rest are still created.</p>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-04-12T08:00:00Z', updatedAt: '2026-07-08T10:40:00Z',
  },
  {
    id: 'art-app-trouble', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'app-troubleshooting',
    title: 'App troubleshooting', excerpt: 'Fix common issues with the GGX app.',
    body: `<p>Most app issues clear up with a few steps.</p><h2>Try these first</h2><ol><li>Update to the latest app version.</li><li>Restart the app and check your connection.</li><li>Sign out and back in if data looks stale.</li></ol>`,
    status: 'published', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 1,
    publishedAt: '2026-03-18T08:00:00Z', updatedAt: '2026-07-05T15:00:00Z',
  },
  // Internal-only — must NEVER appear in the public help center.
  {
    id: 'art-internal-runbook', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'internal-escalation-runbook',
    title: 'Internal escalation runbook', excerpt: 'Agent-only runbook for escalating incidents.',
    body: `<p>This runbook is for support agents only and must not be shown to requesters.</p><h2>Escalation path</h2><ul><li>L1 gathers details and attempts first-line resolution.</li><li>L2 handles specialist cases.</li></ul>`,
    status: 'published', visibility: 'internal', ownerId: 'kb_editor', featured: false, order: 2,
    publishedAt: '2026-03-22T08:00:00Z', updatedAt: '2026-06-10T09:00:00Z',
  },
  // Draft — must NEVER appear publicly until published.
  {
    id: 'art-draft-features', brandId: BRAND, kbCategoryId: 'cat-technical', slug: 'upcoming-feature-notes',
    title: 'Upcoming feature notes', excerpt: 'Draft notes about features not yet released.',
    body: `<p>Draft placeholder for upcoming feature documentation.</p>`,
    status: 'draft', visibility: 'public', ownerId: 'kb_editor', featured: false, order: 3,
    publishedAt: undefined, updatedAt: '2026-07-09T11:00:00Z',
  },
];

// Legal documents: the General TOS plus independently editable annexes. `order`
// is authored across the whole set, so the TOS is not pinned to position 1 by
// its creation date — it is there because an admin put it there.
export const kbLegalDocuments: KbLegalDocument[] = [
  {
    id: 'legal-tos', brandId: BRAND, slug: 'general-terms-of-service',
    title: 'General Terms of Service', kind: 'tos',
    summary: 'The master agreement between you and GGX. The annexes below form part of these terms.',
    body: `<p>These General Terms of Service (the "Terms") govern your use of the GGX platform, applications, and delivery services. By creating an account or booking a shipment you agree to them.</p><h2>Scope of these terms</h2><p>These Terms apply to every user of the platform. Where an annex addresses a specific subject, the annex governs that subject.</p><ul><li>The annexes listed under <a href="#annexes-to-these-terms">Annexes to these terms</a> form part of this agreement.</li><li>If an annex conflicts with these Terms, the annex prevails for its subject matter only.</li></ul><h2>Your account</h2><ol><li>You must provide accurate registration details and keep them current.</li><li>You are responsible for activity under your account credentials.</li><li>We may suspend an account that breaches the <a href="/help/legal/acceptable-use-policy">Acceptable Use Policy</a>.</li></ol><h2>Bookings and delivery</h2><p>A booking is an instruction to collect and deliver a parcel. We accept a booking when a tracking number is issued.</p><ol><li>You warrant that the parcel contents are lawful and correctly declared.<ul><li>Prohibited items are listed in the <a href="/help/legal/acceptable-use-policy#prohibited-items">Acceptable Use Policy</a>.</li><li>Misdeclared parcels may be held or returned at your cost.</li></ul></li><li>Delivery estimates are targets, not guarantees.</li><li>Undeliverable parcels are handled as described in <a href="/help/a/why-a-parcel-is-returned-to-seller">Return to Seller</a>.</li></ol><h2>Fees and payment</h2><p>Fees are shown before you confirm a booking. Seller-specific fees, COD handling, and payout timing are set out in the <a href="/help/legal/seller-terms#payouts-and-remittance">Seller Terms</a>.</p><h2>Liability</h2><p>Our liability for loss of or damage to a parcel is limited to the amounts stated in the <a href="/help/legal/refunds-and-claims-policy#liability-caps">Refunds &amp; Claims Policy</a>. Nothing in these Terms excludes liability that cannot be excluded by law.</p><h2>Privacy</h2><p>Personal data is processed in accordance with our <a href="/help/legal/privacy-policy">Privacy Policy</a>.</p><h2>Annexes to these terms</h2><p>The following annexes form part of these Terms:</p><ul><li><a href="/help/legal/privacy-policy">Privacy Policy</a> — what we collect and why.</li><li><a href="/help/legal/acceptable-use-policy">Acceptable Use Policy</a> — prohibited items and conduct.</li><li><a href="/help/legal/seller-terms">Seller Terms</a> — merchant obligations, fees, and payouts.</li><li><a href="/help/legal/refunds-and-claims-policy">Refunds &amp; Claims Policy</a> — claim windows and liability caps.</li></ul><h2>Changes to these terms</h2><p>We may update these Terms or any annex. Material changes are announced before they take effect, and each document shows its own last-updated date.</p><h2>Contact</h2><p>Questions about these Terms can be raised through the <a href="/help">Help Center</a>.</p>`,
    status: 'published', ownerId: 'kb_editor', order: 1,
    publishedAt: '2026-01-15T08:00:00Z', updatedAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'legal-privacy', brandId: BRAND, slug: 'privacy-policy',
    title: 'Annex A — Privacy Policy', kind: 'annex',
    summary: 'What personal data we collect, why we process it, and how long we keep it.',
    body: `<p>This Annex forms part of the <a href="/help/legal/general-terms-of-service">General Terms of Service</a> and describes how GGX handles personal data.</p><h2>Data we collect</h2><ul><li><strong>Account data</strong> — name, email, mobile number, and saved addresses.</li><li><strong>Shipment data</strong> — pickup and delivery addresses, parcel details, and tracking events.</li><li><strong>Payment data</strong> — transaction records and COD collection amounts.<ul><li>Card details are held by our payment processor, not by GGX.</li></ul></li><li><strong>Technical data</strong> — device, app version, and diagnostic logs.</li></ul><h2>Why we process it</h2><ol><li>To perform the delivery you booked, including sharing the recipient's address with the assigned rider.</li><li>To handle claims and disputes under the <a href="/help/legal/refunds-and-claims-policy">Refunds &amp; Claims Policy</a>.</li><li>To detect fraud and enforce the <a href="/help/legal/acceptable-use-policy">Acceptable Use Policy</a>.</li><li>To meet legal and tax obligations.</li></ol><h2>Retention</h2><p>Shipment and transaction records are retained for the period required by law. Account data is deleted on request unless we must retain it for an open claim or a legal obligation.</p><h2>Sharing</h2><ul><li>Riders and delivery partners receive only the data needed to complete the delivery.</li><li>We do not sell personal data.</li></ul><h2>Your rights</h2><p>You may request access to, correction of, or deletion of your personal data. See <a href="/help/a/update-your-profile">Update your profile</a> for the self-service options, or raise a request through the <a href="/help">Help Center</a>.</p>`,
    status: 'published', ownerId: 'kb_editor', order: 2,
    publishedAt: '2026-01-15T08:00:00Z', updatedAt: '2026-05-20T09:30:00Z',
  },
  {
    id: 'legal-aup', brandId: BRAND, slug: 'acceptable-use-policy',
    title: 'Annex B — Acceptable Use Policy', kind: 'annex',
    summary: 'Prohibited items, prohibited conduct, and the consequences of a breach.',
    body: `<p>This Annex forms part of the <a href="/help/legal/general-terms-of-service">General Terms of Service</a> and applies to every parcel and every account.</p><h2>Prohibited items</h2><p>The following must never be shipped through GGX:</p><ul><li>Explosives, flammable gases, and other dangerous goods</li><li>Illegal drugs and controlled substances</li><li>Live animals</li><li>Currency, bearer instruments, and precious metals</li><li>Counterfeit goods</li></ul><h2>Restricted items</h2><ol><li>Lithium batteries — permitted only when installed in a device and declared at booking.</li><li>Perishables — permitted on same-day lanes only. See <a href="/help/a/same-day-cutoff-times">same-day cutoff times</a>.</li><li>Fragile goods — permitted when packed to our standards; liability is limited under <a href="/help/legal/refunds-and-claims-policy#liability-caps">Liability caps</a>.</li></ol><h2>Prohibited conduct</h2><ul><li>Misdeclaring a parcel's contents or value</li><li>Abusing or threatening riders and support staff</li><li>Using the platform to harass a recipient</li><li>Automated scraping of the platform outside a documented integration</li></ul><h2>Consequences of a breach</h2><p>We may hold or return a parcel, suspend an account, and report unlawful activity to the authorities. Parcels held for a breach are returned at the sender's cost under the fee schedule in the <a href="/help/legal/seller-terms#fees-and-surcharges">Seller Terms</a>.</p>`,
    status: 'published', ownerId: 'kb_editor', order: 3,
    publishedAt: '2026-01-15T08:00:00Z', updatedAt: '2026-04-28T13:15:00Z',
  },
  {
    id: 'legal-seller', brandId: BRAND, slug: 'seller-terms',
    title: 'Annex C — Seller Terms', kind: 'annex',
    summary: 'Additional terms for merchants: obligations, fees, surcharges, and payout timing.',
    body: `<p>This Annex forms part of the <a href="/help/legal/general-terms-of-service">General Terms of Service</a> and applies in addition to them where you ship as a merchant.</p><h2>Seller obligations</h2><ol><li>Pack each parcel to withstand normal handling.</li><li>Declare contents and value accurately, in line with the <a href="/help/legal/acceptable-use-policy#prohibited-items">prohibited items</a> list.</li><li>Hand over parcels within the agreed pickup window.</li></ol><h2>Fees and surcharges</h2><ul><li><strong>Base rate</strong> — charged per lane and weight bracket at booking.</li><li><strong>Return leg</strong> — charged at the standard rate when a parcel is returned to seller.<ul><li>The original delivery fee is not refunded.</li><li>See <a href="/help/a/return-to-seller-timelines-and-fees">Return to seller timelines and fees</a>.</li></ul></li><li><strong>Remote area surcharge</strong> — applied to destinations outside standard coverage.</li><li><strong>Misdeclaration surcharge</strong> — applied when actual weight or contents differ from the declaration.</li></ul><h2>Payouts and remittance</h2><ol><li>COD funds collected are held on your behalf and remitted on the standard schedule.</li><li>Remittance runs weekly, net of fees and surcharges accrued in the period.</li><li>We may withhold a remittance covering an open claim until the claim is resolved under the <a href="/help/legal/refunds-and-claims-policy">Refunds &amp; Claims Policy</a>.</li></ol><p>Day-to-day payout tracking is available in the <a href="/help/a/using-the-seller-dashboard">seller dashboard</a>.</p><h2>Term and termination</h2><p>Either party may end the merchant relationship on notice. Outstanding remittances are settled after all in-flight parcels reach a final state.</p>`,
    status: 'published', ownerId: 'kb_editor', order: 4,
    publishedAt: '2026-02-01T08:00:00Z', updatedAt: '2026-06-25T15:45:00Z',
  },
  {
    id: 'legal-claims', brandId: BRAND, slug: 'refunds-and-claims-policy',
    title: 'Annex D — Refunds & Claims Policy', kind: 'annex',
    summary: 'Claim windows, evidence requirements, liability caps, and refund handling.',
    body: `<p>This Annex forms part of the <a href="/help/legal/general-terms-of-service">General Terms of Service</a> and governs claims for lost, damaged, or delayed parcels.</p><h2>Claim windows</h2><ul><li><strong>Damage</strong> — within 24 hours of delivery.</li><li><strong>Loss</strong> — within 14 days of the last tracking event.</li><li><strong>Non-delivery of COD funds</strong> — within 30 days of the remittance date.</li></ul><p>Claims filed after the applicable window are not accepted. To file, follow <a href="/help/a/file-a-claim-for-a-lost-parcel">File a claim for a lost parcel</a>.</p><h2>Evidence</h2><ol><li>The tracking number and booking reference.</li><li>Photographs of the parcel and packaging, for damage claims.</li><li>Proof of the declared value, such as an invoice or receipt.</li></ol><h2>Liability caps</h2><p>Unless a higher declared value was accepted and the corresponding surcharge paid, our liability per parcel is capped at the lower of:</p><ul><li>the declared value of the parcel; or</li><li>the standard cap for the service level used.</li></ul><p>We are not liable for consequential loss, or for delay where the estimate was met within the tolerances in <a href="/help/a/delivery-timelines">Delivery timelines</a>.</p><h2>Refunds</h2><ol><li>Approved claims are refunded to the original payment method, or offset against the next remittance for merchants.</li><li>Refunds are processed within 10 business days of approval.</li></ol>`,
    status: 'published', ownerId: 'kb_editor', order: 5,
    publishedAt: '2026-02-01T08:00:00Z', updatedAt: '2026-07-03T08:20:00Z',
  },
  // Draft annex — must NEVER appear on the public legal index until published.
  {
    id: 'legal-dpa', brandId: BRAND, slug: 'data-processing-addendum',
    title: 'Annex E — Data Processing Addendum', kind: 'annex',
    summary: 'Controller-to-processor terms for merchants handling EU personal data.',
    body: `<p>Draft addendum covering controller-to-processor obligations. Pending legal review before publication.</p><h2>Subject matter</h2><p>This Addendum will supplement the <a href="/help/legal/privacy-policy">Privacy Policy</a> for merchants who are data controllers.</p>`,
    status: 'draft', ownerId: 'kb_editor', order: 6,
    publishedAt: undefined, updatedAt: '2026-07-11T16:00:00Z',
  },
];

// Revision history (snapshots captured on edit), shared by FAQ articles and legal
// documents. Seeded with one prior revision.
export const kbRevisions: KbRevision[] = [
  { id: 'rev-book-1', articleId: 'art-book', editorId: 'kb_editor', title: 'How to book a delivery', body: '<p>Booking a delivery with GGX takes just a minute.</p><h2>Steps</h2><ul><li>Open the app and tap Book a delivery.</li></ul>', createdAt: '2026-03-02T08:00:00Z' },
];
