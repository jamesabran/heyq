/**
 * http — minimal node:http router mounting every server/ module under /api/*.
 *
 * No framework (per the M23/M24 decision): manual method+path matching, a tiny
 * JSON body reader, and a consistent JSON envelope on errors. The `X-Store-Id`
 * header resolves which in-memory store a request operates on (server/store.ts)
 * — absent in the browser (defaults to `'default'`), set by the vitest test
 * bootstrap so test files stay isolated from each other and from demo data.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import * as tickets from './tickets.ts';
import * as notifications from './notifications.ts';
import * as orderProvider from './orderProvider.ts';
import * as requester from './requester.ts';
import * as reports from './reports.ts';
import * as audit from './audit.ts';
import * as customer from './customer.ts';
import * as reviews from './reviews.ts';
import * as aiReview from './aiReview.ts';
import { requireRole } from './authz.ts';
import { REVIEW_ROLES } from '../src/app/lib/roles.ts';
import { attachRealtime, mintAgentToken, mintCustomerToken } from './realtime.ts';
import { getStore, setDown } from './store.ts';
import { parseMultipart, type MultipartFile } from './multipart.ts';
import {
  AttachmentValidationError,
  downloadHeaders,
  getAttachmentForTicket,
  listTicketAttachments,
  validateUploads,
  type UploadFile,
} from './attachments.ts';
import { isVisibleToRequester } from './visibility.ts';

type Params = Record<string, string>;
type Query = URLSearchParams;
type Handler = (req: IncomingMessage, params: Params, query: Query, storeId: string) => Promise<unknown>;

/**
 * A raw binary response (attachment downloads). Handlers return this instead of a
 * JSON value; the router writes the bytes + headers verbatim. `__raw` tags it so
 * the JSON path never touches a file body.
 */
interface RawResponse {
  __raw: true;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}
const isRawResponse = (value: unknown): value is RawResponse =>
  !!value && typeof value === 'object' && (value as RawResponse).__raw === true;

/** Whether a request carries a multipart/form-data body (an upload). */
const isMultipart = (req: IncomingMessage): boolean =>
  /multipart\/form-data/i.test(req.headers['content-type'] ?? '');

/** Turn parsed multipart file parts (field "files") into validated upload inputs. */
function filesToUploads(files: MultipartFile[]): UploadFile[] {
  return files
    .filter((f) => f.field === 'files')
    .map((f) => ({ filename: f.filename, contentType: f.contentType, data: f.data }));
}

/**
 * Ticket-level authorization for the customer attachment routes: the requester
 * (identity from the query) must be allowed to SEE the ticket, exactly like the
 * customer ticket reads. Throws "not found" otherwise — a requester learns nothing
 * about a ticket that isn't theirs, and can't fetch its files by guessing an id.
 */
function requireCustomerTicketVisible(storeId: string, ticketId: string, q: Query): void {
  const identity = { externalUserId: q.get('externalUserId') ?? '', externalOrgId: q.get('externalOrgId') ?? '' };
  const ticket = getStore(storeId).tickets.find((t) => t.id === ticketId);
  if (!ticket || !isVisibleToRequester(ticket, identity)) throw new Error('Ticket not found');
}

/**
 * Who a route is for. `public` routes are the CUSTOMER surface (GGX Business+):
 * ticket reads plus requester reply/reopen — the same requester actions HeyQ's
 * own portal performs. Everything else is `internal`: the agent app, the contact
 * form's order picker, the portal token exchange, notifications, reports, audit.
 * The default is `internal`, so a new route is closed to customers until it is
 * deliberately opened. Enforcement is in `handleRequest`.
 */
type RouteAccess = 'public' | 'internal';

interface Route {
  method: string;
  pattern: string;
  handler: Handler;
  /** Omitted ⇒ 'internal'. Only routes GGX Business+ must reach are 'public'. */
  access?: RouteAccess;
}

function matchPattern(pattern: string, pathname: string): Params | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = pathname.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;

  const params: Params = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    const seg = decodeURIComponent(pathParts[i]);
    if (part.startsWith(':')) params[part.slice(1)] = seg;
    else if (part !== seg) return null;
  }
  return params;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped input at the HTTP trust boundary; each handler destructures the fields it expects.
function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// This API is cross-origin to every browser app that calls it, so CORS is
// required. Two KINDS of caller exist, and they may reach different routes:
//
//   • AGENT origins — HeyQ's own frontend (agent app + requester portal + the
//     contact form). Reach every route. Defaults: the local Vite dev server and
//     the deployed Vercel frontend; extend with HEYQ_FRONTEND_ORIGIN.
//   • CUSTOMER origins — GGX Business+. Reach ONLY `public` routes; agent/
//     internal routes are refused (see handleRequest). Defaults: Business+ local
//     dev and its deployed Vercel origin; extend with HEYQ_BUSINESS_PLUS_ORIGIN.
//
// Both lists are environment-driven so a new deployment adds its real origin
// without a code change. Each variable accepts a comma-separated list.
const DEFAULT_AGENT_ORIGINS = ['http://localhost:18020', 'https://heyq.vercel.app'];
const DEFAULT_CUSTOMER_ORIGINS = ['http://localhost:18010', 'https://ggx-corporate.vercel.app'];

function envOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const agentOrigins = (): string[] => [...DEFAULT_AGENT_ORIGINS, ...envOrigins(process.env.HEYQ_FRONTEND_ORIGIN)];
const customerOrigins = (): string[] => [...DEFAULT_CUSTOMER_ORIGINS, ...envOrigins(process.env.HEYQ_BUSINESS_PLUS_ORIGIN)];
const allowedOrigins = (): string[] => [...agentOrigins(), ...customerOrigins()];

/** A customer origin may only reach `public` routes. */
const isCustomerOrigin = (origin: string | undefined): boolean =>
  !!origin && customerOrigins().includes(origin);

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Store-Id');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

function statusForError(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return 404;
  if (/not authorized/i.test(msg)) return 403;
  if (/unreachable|unavailable/i.test(msg)) return 503;
  return 400;
}

const bool = (v: string | null) => v === '1' || v === 'true';

const routes: Route[] = [
  { method: 'GET', pattern: '/health', handler: async () => ({ ok: true }), access: 'public' },

  // ── Test-only infrastructure controls (used by orderProvider.test.ts and
  // businessPlusFlow.test.ts to simulate an outage / an upstream live update —
  // never called by product code). ──────────────────────────────────────────
  {
    method: 'POST', pattern: '/_test/down',
    handler: async (req, _p, _q, storeId) => {
      setDown(storeId, Boolean((await readJsonBody(req)).down));
      return { ok: true };
    },
  },
  {
    method: 'PATCH', pattern: '/_test/business-plus-orders/:externalOrderId',
    handler: async (req, p, _q, storeId) => {
      const { shipmentStatus } = await readJsonBody(req);
      orderProvider.setOrderShipmentStatusForTest(storeId, p.externalOrderId, shipmentStatus);
      return { ok: true };
    },
  },

  // ── Tickets ──────────────────────────────────────────────────────────────
  {
    method: 'POST', pattern: '/tickets',
    handler: async (req, _p, _q, storeId) => tickets.createTicket(storeId, await readJsonBody(req)),
  },
  {
    method: 'POST', pattern: '/tickets/internal',
    handler: async (req, _p, _q, storeId) => tickets.createInternalTicket(storeId, await readJsonBody(req)),
  },
  {
    method: 'GET', pattern: '/tickets',
    handler: async (_req, _p, q, storeId) =>
      tickets.listTickets(storeId, {
        queue: (q.get('queue') as tickets.TicketQueue) ?? undefined,
        viewerId: q.get('viewerId') ?? undefined,
        viewerTeamId: q.get('viewerTeamId') ?? undefined,
        status: (q.get('status') as never) ?? undefined,
        priority: (q.get('priority') as never) ?? undefined,
        reopened: q.has('reopened') ? bool(q.get('reopened')) : undefined,
        requesterId: q.get('requesterId') ?? undefined,
        search: q.get('search') ?? undefined,
        sort: (q.get('sort') as never) ?? undefined,
      }),
  },
  {
    method: 'GET', pattern: '/tickets/:id',
    handler: async (_req, p, _q, storeId) => {
      const t = await tickets.getTicketById(storeId, p.id);
      if (!t) throw new Error('Ticket not found');
      return t;
    },
  },
  {
    method: 'GET', pattern: '/tickets/:id/detail',
    handler: async (_req, p, _q, storeId) => {
      const t = await tickets.getTicketDetail(storeId, p.id);
      if (!t) throw new Error('Ticket not found');
      return t;
    },
  },
  {
    method: 'GET', pattern: '/tickets/:id/messages',
    handler: async (_req, p, _q, storeId) => tickets.listMessages(storeId, p.id),
  },
  {
    // Requester reply — the same action HeyQ's portal performs. Customer-facing.
    // Accepts multipart (a reply WITH file attachments) or JSON (text only /
    // legacy metadata). Files are validated BEFORE the message is created, so a
    // rejected batch never produces a message that references a missing upload.
    method: 'POST', pattern: '/tickets/:id/messages',
    handler: async (req, p, _q, storeId) => {
      if (isMultipart(req)) {
        const { fields, files } = await parseMultipart(req);
        const uploads = filesToUploads(files);
        if (uploads.length) validateUploads(uploads);
        return tickets.addRequesterMessage(storeId, p.id, fields.body ?? '', undefined, uploads);
      }
      const body = await readJsonBody(req);
      return tickets.addRequesterMessage(storeId, p.id, body.body, body.attachments);
    },
    access: 'public',
  },
  {
    // Requester reopen — customer-facing, like the portal's reopen.
    method: 'POST', pattern: '/tickets/:id/reopen',
    handler: async (_req, p, _q, storeId) => tickets.reopenTicket(storeId, p.id),
    access: 'public',
  },
  {
    method: 'POST', pattern: '/tickets/:id/hold',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.holdTicket(storeId, p.id, body.agentId, body.reason, body.note);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/resume',
    handler: async (req, p, _q, storeId) => tickets.resumeTicket(storeId, p.id, (await readJsonBody(req)).agentId),
  },
  {
    // Agent public reply. Multipart (with attachments) or JSON (text/legacy).
    method: 'POST', pattern: '/tickets/:id/agent-reply',
    handler: async (req, p, _q, storeId) => {
      if (isMultipart(req)) {
        const { fields, files } = await parseMultipart(req);
        const uploads = filesToUploads(files);
        if (uploads.length) validateUploads(uploads);
        return tickets.addAgentReply(storeId, p.id, fields.agentId ?? '', fields.body ?? '', undefined, uploads);
      }
      const body = await readJsonBody(req);
      return tickets.addAgentReply(storeId, p.id, body.agentId, body.body, body.attachments);
    },
  },
  // ── Ticket attachments (agent surface) ─────────────────────────────────────
  {
    // Consolidated attachment list for a ticket (agent/internal).
    method: 'GET', pattern: '/tickets/:id/attachments',
    handler: async (_req, p, _q, storeId) => listTicketAttachments(storeId, p.id),
  },
  {
    // Authorized download/preview (agent/internal). `?disposition=inline` renders
    // images/PDFs inline; everything else is served as an attachment.
    method: 'GET', pattern: '/tickets/:id/attachments/:attachmentId',
    handler: async (_req, p, q, storeId): Promise<RawResponse> => {
      const store = getStore(storeId);
      if (!store.tickets.find((t) => t.id === p.id)) throw new Error('Ticket not found');
      const resolved = getAttachmentForTicket(storeId, p.id, p.attachmentId);
      if (!resolved) throw new Error('Attachment not found');
      const wantInline = q.get('disposition') === 'inline';
      return { __raw: true, status: 200, headers: downloadHeaders(resolved.record, wantInline), body: resolved.bytes };
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/notes',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.addInternalNote(storeId, p.id, body.agentId, body.body, body.attachments);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/resolve',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.resolveTicket(storeId, p.id, body.agentId, body.resolutionType, body.note);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/assign',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.assignTicket(storeId, p.id, body.actor, body.toAssigneeId);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/claim',
    handler: async (req, p, _q, storeId) => tickets.claimTicket(storeId, p.id, (await readJsonBody(req)).agentId),
  },
  {
    method: 'POST', pattern: '/tickets/:id/reclassify',
    handler: async (req, p, _q, storeId) => {
      const { actor, ...changes } = await readJsonBody(req);
      return tickets.reclassifyTicket(storeId, p.id, actor, changes);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/escalate',
    handler: async (req, p, _q, storeId) => {
      const { actor, ...input } = await readJsonBody(req);
      return tickets.escalateTicket(storeId, p.id, actor, input);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/deescalate',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.deescalateTicket(storeId, p.id, body.actor, body.note, body.toTeamId);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/link-transaction',
    handler: async (req, p, _q, storeId) => tickets.linkTransaction(storeId, p.id, (await readJsonBody(req)).transactionId),
  },

  // ── Realtime connection tokens (short-lived, single-use) ───────────────────
  // Agent token: internal route (origin-trusted agent app), scoped to the agent.
  {
    method: 'POST', pattern: '/realtime/token',
    handler: async (req, _p, _q, storeId) => mintAgentToken(storeId, (await readJsonBody(req)).agentId ?? ''),
  },

  // ── Notifications ────────────────────────────────────────────────────────
  {
    method: 'GET', pattern: '/notifications',
    handler: async (_req, _p, q, storeId) => notifications.listForRecipient(storeId, q.get('recipientId') ?? ''),
  },
  {
    method: 'GET', pattern: '/notifications/unread-count',
    handler: async (_req, _p, q, storeId) => ({ count: await notifications.unreadCount(storeId, q.get('recipientId') ?? '') }),
  },
  {
    method: 'POST', pattern: '/notifications/:id/read',
    handler: async (_req, p, _q, storeId) => {
      await notifications.markRead(storeId, p.id);
      return { ok: true };
    },
  },
  {
    method: 'POST', pattern: '/notifications/read-all',
    handler: async (req, _p, _q, storeId) => {
      await notifications.markAllRead(storeId, (await readJsonBody(req)).recipientId);
      return { ok: true };
    },
  },
  {
    method: 'GET', pattern: '/notification-prefs',
    handler: async (_req, _p, _q, storeId) => notifications.getMutedEvents(storeId),
  },
  {
    method: 'PUT', pattern: '/notification-prefs',
    handler: async (req, _p, _q, storeId) => {
      const body = await readJsonBody(req);
      await notifications.setEventMuted(storeId, body.event, body.muted);
      return { ok: true };
    },
  },

  // ── Business+ order provider (mock) ──────────────────────────────────────
  {
    method: 'GET', pattern: '/business-plus-orders',
    handler: async (_req, _p, q, storeId) =>
      orderProvider.listAuthorizedOrders(
        storeId,
        { externalUserId: q.get('externalUserId') ?? '', externalOrgId: q.get('externalOrgId') ?? '' },
        q.get('query') ?? undefined,
      ),
  },
  {
    method: 'GET', pattern: '/business-plus-orders/:externalOrderId',
    handler: async (_req, p, q, storeId) =>
      orderProvider.getAuthorizedOrder(
        storeId,
        { externalUserId: q.get('externalUserId') ?? '', externalOrgId: q.get('externalOrgId') ?? '' },
        p.externalOrderId,
      ),
  },
  {
    method: 'GET', pattern: '/business-plus-orders/:externalOrderId/support',
    handler: async (_req, p, _q, storeId) => orderProvider.getOrderForSupport(storeId, p.externalOrderId),
  },

  // ── Requester portal ─────────────────────────────────────────────────────
  {
    method: 'GET', pattern: '/portal/:token',
    handler: async (_req, p, _q, storeId) => {
      const view = await requester.resolveAccessToken(storeId, p.token);
      if (!view) throw new Error('Portal link not found');
      return view;
    },
  },
  {
    method: 'GET', pattern: '/requesters/:id/profile',
    handler: async (_req, p, _q, storeId) => {
      const profile = await requester.getRequesterProfile(storeId, p.id);
      if (!profile) throw new Error('Requester not found');
      return profile;
    },
  },
  {
    method: 'GET', pattern: '/requesters/:id/tickets',
    handler: async (_req, p, _q, storeId) => requester.listTicketsForRequester(storeId, p.id),
  },

  // ── Reports ──────────────────────────────────────────────────────────────
  {
    method: 'GET', pattern: '/reports/summary',
    handler: async (_req, _p, q, storeId) => reports.getSummary(storeId, q.get('team') ?? undefined),
  },

  // ── Audit (ticket-derived; KB entries are merged client-side) ───────────
  {
    method: 'GET', pattern: '/audit/tickets',
    handler: async (_req, _p, q, storeId) =>
      audit.listTicketAuditEntries(storeId, {
        category: (q.get('category') as never) ?? undefined,
        actorId: q.get('actor') ?? undefined,
        search: q.get('q') ?? undefined,
      }),
  },
  {
    method: 'GET', pattern: '/audit/tickets/actors',
    handler: async (_req, _p, _q, storeId) => audit.listTicketAuditActors(storeId),
  },

  // ── Quality reviews (Supervisor) — internal only, never customer-facing ─────
  {
    method: 'GET', pattern: '/reviews',
    handler: async (_req, _p, _q, storeId) => reviews.listReviews(storeId),
  },
  {
    method: 'GET', pattern: '/reviews/reviewable',
    handler: async (_req, _p, q, storeId) => reviews.listReviewable(storeId, q.get('agentId') ?? undefined),
  },
  {
    method: 'GET', pattern: '/reviews/workspace/:ticketId',
    handler: async (_req, p, _q, storeId) => {
      const data = await reviews.getWorkspace(storeId, p.ticketId);
      if (!data) throw new Error('Ticket not found');
      return data;
    },
  },
  {
    method: 'POST', pattern: '/reviews/draft',
    handler: async (req, _p, _q, storeId) => {
      const b = await readJsonBody(req);
      return reviews.saveDraft(storeId, {
        ticketId: b.ticketId, reviewerId: b.reviewerId, responses: b.responses ?? {}, feedback: b.feedback,
      });
    },
  },
  {
    method: 'POST', pattern: '/reviews/submit',
    handler: async (req, _p, _q, storeId) => {
      const b = await readJsonBody(req);
      return reviews.submitReview(storeId, {
        ticketId: b.ticketId, reviewerId: b.reviewerId, responses: b.responses ?? {}, feedback: b.feedback,
      });
    },
  },
  {
    // Explicitly re-run an AI review for one ticket — the supervisor's fallback
    // after the automatic review that resolution already started. Role-checked
    // SERVER-side so the restriction survives a caller that never loads the UI;
    // refused outright when an admin has AI reviews turned off, and refused for
    // a ticket that is still active (server/aiReview.ts) so a direct API call
    // cannot review work that is not finished. Awaited, because a supervisor is
    // watching a button — unlike the automatic run, which is not.
    method: 'POST', pattern: '/reviews/ai/run',
    handler: async (req, _p, _q, storeId) => {
      const b = await readJsonBody(req);
      requireRole(b.actorId, REVIEW_ROLES, 'run an AI quality review');
      return aiReview.runAiReview(storeId, b.ticketId);
    },
  },

  // ── Customer (Business+) visibility surface ─────────────────────────────
  // The customer read surface. Server-side visibility policy (server/visibility.ts)
  // decides what a requester may see; these are the only reads Business+ makes.
  {
    method: 'GET', pattern: '/customer/tickets',
    handler: async (_req, _p, q, storeId) =>
      customer.listCustomerTickets(storeId, {
        externalUserId: q.get('externalUserId') ?? '',
        externalOrgId: q.get('externalOrgId') ?? '',
      }),
    access: 'public',
  },
  {
    method: 'GET', pattern: '/customer/tickets/:id',
    handler: async (_req, p, q, storeId) => {
      const t = await customer.getCustomerTicket(
        storeId,
        { externalUserId: q.get('externalUserId') ?? '', externalOrgId: q.get('externalOrgId') ?? '' },
        p.id,
      );
      if (!t) throw new Error('Ticket not found');
      return t;
    },
    access: 'public',
  },
  {
    // Ticket creation from the embedded Business+ report drawer. Returns the
    // customer projection only. Identity + linked order are trusted (Business+
    // owns OMS authorization). Multipart carries creation-time attachments (files
    // validated BEFORE the ticket is created — an invalid batch never half-creates).
    method: 'POST', pattern: '/customer/tickets',
    handler: async (req, _p, _q, storeId) => {
      let b: Record<string, unknown>;
      let uploads: UploadFile[] = [];
      if (isMultipart(req)) {
        const { fields, files } = await parseMultipart(req);
        uploads = filesToUploads(files);
        if (uploads.length) validateUploads(uploads);
        b = {
          ...fields,
          linkedOrder: fields.linkedOrder ? JSON.parse(fields.linkedOrder) : undefined,
          linkedTransactions: fields.linkedTransactions ? JSON.parse(fields.linkedTransactions) : undefined,
        };
      } else {
        b = await readJsonBody(req);
      }
      return customer.createCustomerTicket(storeId, {
        identity: { externalUserId: (b.externalUserId as string) ?? '', externalOrgId: (b.externalOrgId as string) ?? '' },
        name: (b.name as string) ?? '',
        email: (b.email as string) ?? '',
        concernType: (b.concernType as never) ?? undefined,
        subject: (b.subject as string) ?? '',
        description: (b.description as string) ?? '',
        linkedOrder: (b.linkedOrder as never) ?? undefined,
        linkedTransactions: (b.linkedTransactions as never) ?? undefined,
        uploads: uploads.length ? uploads : undefined,
      });
    },
    access: 'public',
  },
  // ── Ticket attachments (customer surface — visibility-gated) ───────────────
  {
    // Consolidated attachment list, only if the ticket is visible to the requester.
    method: 'GET', pattern: '/customer/tickets/:id/attachments',
    handler: async (_req, p, q, storeId) => {
      requireCustomerTicketVisible(storeId, p.id, q);
      return listTicketAttachments(storeId, p.id);
    },
    access: 'public',
  },
  {
    // Authorized customer download/preview. Ticket-level authorization first
    // (visibility), then the attachment must belong to THAT ticket.
    method: 'GET', pattern: '/customer/tickets/:id/attachments/:attachmentId',
    handler: async (_req, p, q, storeId): Promise<RawResponse> => {
      requireCustomerTicketVisible(storeId, p.id, q);
      const resolved = getAttachmentForTicket(storeId, p.id, p.attachmentId);
      if (!resolved) throw new Error('Attachment not found');
      const wantInline = q.get('disposition') === 'inline';
      return { __raw: true, status: 200, headers: downloadHeaders(resolved.record, wantInline), body: resolved.bytes };
    },
    access: 'public',
  },
  {
    // Customer realtime token: public route. Verifies the requester may see the
    // ticket (throws 404 otherwise), then returns a ticket-scoped token.
    method: 'POST', pattern: '/customer/realtime/token',
    handler: async (req, _p, _q, storeId) => {
      const b = await readJsonBody(req);
      return mintCustomerToken(
        storeId,
        { externalUserId: b.externalUserId ?? '', externalOrgId: b.externalOrgId ?? '' },
        b.ticketId ?? '',
      );
    },
    access: 'public',
  },
];

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  applyCors(req, res);
  if (req.method === 'OPTIONS') {
    // CORS preflight — headers already applied above; no body.
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname.startsWith('/api') ? url.pathname.slice(4) || '/' : url.pathname;
  const storeId = (req.headers['x-store-id'] as string | undefined) ?? 'default';

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (!params) continue;

    // Route protection: the customer app (GGX Business+) may reach only `public`
    // routes. An agent/internal route requested from a known customer origin is
    // refused here — the boundary that keeps agent surfaces off the customer app
    // at this no-auth mock stage. (Server-to-server and test calls carry no
    // Origin and are unaffected; the agent frontend is not a customer origin.)
    if (route.access !== 'public' && isCustomerOrigin(req.headers.origin)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'This endpoint is not available to customer applications.' }));
      return;
    }

    try {
      const result = await route.handler(req, params, url.searchParams, storeId);
      if (isRawResponse(result)) {
        // Binary download — CORS headers were already applied above.
        res.writeHead(result.status, result.headers);
        res.end(result.body);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result ?? null));
    } catch (err) {
      // Attachment validation failures carry per-file detail so the client can
      // label each rejected file; nothing was stored (validation is a pre-gate).
      if (err instanceof AttachmentValidationError) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message, files: err.errors }));
        return;
      }
      const status = statusForError(err);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `No route for ${req.method} ${pathname}` }));
}

/** Create (but do not start) the HeyQ mock API server, with the realtime channel
 * attached to the same http.Server (WebSocket upgrades on /api/realtime). */
export function createHeyQServer() {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });
  attachRealtime(server);
  return server;
}
