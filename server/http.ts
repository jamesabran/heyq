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

interface Route {
  method: string;
  pattern: string;
  handler: Handler;
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

function statusForError(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not found/i.test(msg)) return 404;
  if (/unreachable|unavailable/i.test(msg)) return 503;
  return 400;
}

const bool = (v: string | null) => v === '1' || v === 'true';

const routes: Route[] = [
  { method: 'GET', pattern: '/health', handler: async () => ({ ok: true }) },

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
    method: 'POST', pattern: '/tickets/:id/messages',
    handler: async (req, p, _q, storeId) => tickets.addRequesterMessage(storeId, p.id, (await readJsonBody(req)).body),
  },
  {
    method: 'POST', pattern: '/tickets/:id/reopen',
    handler: async (_req, p, _q, storeId) => tickets.reopenTicket(storeId, p.id),
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
  {
    method: 'GET', pattern: '/customer/tickets',
    handler: async (_req, _p, q, storeId) =>
      customer.listCustomerTickets(storeId, {
        externalUserId: q.get('externalUserId') ?? '',
        externalOrgId: q.get('externalOrgId') ?? '',
      }),
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
  },
];

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const pathname = url.pathname.startsWith('/api') ? url.pathname.slice(4) || '/' : url.pathname;
  const storeId = (req.headers['x-store-id'] as string | undefined) ?? 'default';

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = matchPattern(route.pattern, pathname);
    if (!params) continue;

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
