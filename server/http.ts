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
import { setDown } from './store.ts';

type Params = Record<string, string>;
type Query = URLSearchParams;
type Handler = (req: IncomingMessage, params: Params, query: Query, storeId: string) => Promise<unknown>;

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
    method: 'POST', pattern: '/tickets/:id/messages',
    handler: async (req, p, _q, storeId) => tickets.addRequesterMessage(storeId, p.id, (await readJsonBody(req)).body),
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
    method: 'POST', pattern: '/tickets/:id/agent-reply',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.addAgentReply(storeId, p.id, body.agentId, body.body);
    },
  },
  {
    method: 'POST', pattern: '/tickets/:id/notes',
    handler: async (req, p, _q, storeId) => {
      const body = await readJsonBody(req);
      return tickets.addInternalNote(storeId, p.id, body.agentId, body.body);
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
    // owns OMS authorization).
    method: 'POST', pattern: '/customer/tickets',
    handler: async (req, _p, _q, storeId) => {
      const b = await readJsonBody(req);
      return customer.createCustomerTicket(storeId, {
        identity: { externalUserId: b.externalUserId ?? '', externalOrgId: b.externalOrgId ?? '' },
        name: b.name ?? '',
        email: b.email ?? '',
        concernType: b.concernType ?? undefined,
        subject: b.subject ?? '',
        description: b.description ?? '',
        linkedOrder: b.linkedOrder ?? undefined,
      });
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result ?? null));
    } catch (err) {
      const status = statusForError(err);
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `No route for ${req.method} ${pathname}` }));
}

/** Create (but do not start) the HeyQ mock API server. */
export function createHeyQServer() {
  return createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });
}
