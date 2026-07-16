/**
 * Realtime channel integration tests (server/realtime.ts).
 *
 * These drive real ticket mutations through the client services (which POST to
 * the test API server started by src/test/setup.ts) and assert on the events a
 * WebSocket subscriber receives — proving persistence-then-broadcast, audience
 * isolation, subscription authorization, and typing lifecycle end to end.
 */
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import {
  __resetRealtimeForTest,
  mintAgentToken,
  mintCustomerToken,
} from './realtime.ts';
// Drive the real ticket lifecycle directly (server functions, `default` store) so
// the persistence→broadcast path fires on the same in-process realtime registry
// the sockets are subscribed to — no browser client is pulled into the node build.
import {
  addAgentReply,
  addInternalNote,
  assignTicket,
  holdTicket,
} from './tickets.ts';

const S = 'default';

const CUSTOMER = { externalUserId: 'max@email.com', externalOrgId: 'main' };

function wsUrl(): string {
  const port = process.env.HEYQ_TEST_API_PORT;
  if (!port) throw new Error('HEYQ_TEST_API_PORT not set');
  return `ws://localhost:${port}/api/realtime`;
}

/** A tiny promise-based WebSocket test client with a matching-message queue. */
class Sock {
  private ws: WebSocket;
  private queue: Record<string, unknown>[] = [];
  private waiters: { pred: (m: Record<string, unknown>) => boolean; resolve: (m: Record<string, unknown>) => void; timer: ReturnType<typeof setTimeout> }[] = [];

  constructor() {
    this.ws = new WebSocket(wsUrl());
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      const i = this.waiters.findIndex((w) => w.pred(m));
      if (i >= 0) {
        const [w] = this.waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(m);
      } else {
        this.queue.push(m);
      }
    });
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
    });
  }

  send(obj: unknown): void {
    this.ws.send(JSON.stringify(obj));
  }

  /** Resolve with the next message matching `pred` (queued or future). */
  next(pred: (m: Record<string, unknown>) => boolean, timeout = 2500): Promise<Record<string, unknown>> {
    const i = this.queue.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.queue.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a matching ws message')), timeout);
      this.waiters.push({ pred, resolve, timer });
    });
  }

  close(): void {
    this.ws.close();
  }
}

const isEvent = (type: string) => (m: Record<string, unknown>) =>
  m.t === 'event' && (m.event as { type?: string })?.type === type;

const open: Sock[] = [];

async function agentSub(ticketId: string, agentId = 'l1_agent'): Promise<Sock> {
  const s = new Sock();
  open.push(s);
  await s.open();
  s.send({ t: 'auth', token: mintAgentToken('default', agentId).token });
  await s.next((m) => m.t === 'auth_ok');
  s.send({ t: 'subscribe', ticketId });
  await s.next((m) => m.t === 'subscribed');
  return s;
}

async function customerSub(ticketId: string): Promise<Sock> {
  const s = new Sock();
  open.push(s);
  await s.open();
  s.send({ t: 'auth', token: mintCustomerToken('default', CUSTOMER, ticketId).token });
  await s.next((m) => m.t === 'auth_ok');
  s.send({ t: 'subscribe', ticketId });
  await s.next((m) => m.t === 'subscribed');
  return s;
}

afterEach(() => {
  for (const s of open.splice(0)) s.close();
  __resetRealtimeForTest();
});

describe('delivery + persistence', () => {
  it('broadcasts an agent reply to a subscribed agent after it is persisted', async () => {
    const agent = await agentSub('tkt-seed-3');
    const persisted = await addAgentReply(S, 'tkt-seed-3', 'l1_agent', 'Looking into this now.');
    const ev = await agent.next(isEvent('message.created'));
    const data = (ev.event as { data: { message: { id: string; body: string } } }).data;
    // The broadcast carries the SAME server-assigned id as the persisted record.
    expect(data.message.id).toBe(persisted.id);
    expect(data.message.body).toBe('Looking into this now.');
    expect((ev.event as { actorType: string }).actorType).toBe('agent');
  });

  it('delivers a status change to subscribers', async () => {
    const agent = await agentSub('tkt-seed-6');
    await holdTicket(S, 'tkt-seed-6', 'l1_agent', 'waiting_third_party');
    const ev = await agent.next(isEvent('ticket.status_changed'));
    expect((ev.event as { data: { status: string } }).data.status).toBe('on_hold');
  });
});

describe('audience isolation', () => {
  it('projects a public reply for the customer (no agent name) and delivers the full record to agents', async () => {
    const agent = await agentSub('tkt-bp-1');
    const customer = await customerSub('tkt-bp-1');

    await addAgentReply(S, 'tkt-bp-1', 'l1_agent', 'We have re-attempted delivery.');

    const custEv = await customer.next(isEvent('message.created'));
    const custMsg = (custEv.event as { data: { message: { from: string; authorLabel: string; body: string } } }).data.message;
    expect(custMsg.from).toBe('support');
    expect(custMsg.authorLabel).not.toContain('Alex'); // never the agent's real name
    expect(JSON.stringify(custMsg)).not.toContain('Alex Cruz');

    const agentEv = await agent.next(isEvent('message.created'));
    const agentMsg = (agentEv.event as { data: { message: { authorName: string } } }).data.message;
    expect(agentMsg.authorName).toBe('Alex Cruz');
  });

  it('never delivers internal notes to customer subscribers', async () => {
    const customer = await customerSub('tkt-bp-2');
    await addInternalNote(S, 'tkt-bp-2', 'l1_agent', 'Internal: chasing the hub, do not disclose.');
    await addAgentReply(S, 'tkt-bp-2', 'l1_agent', 'We are chasing this with the hub.');

    // The customer's NEXT message.created is the PUBLIC reply — the note was skipped.
    const ev = await customer.next(isEvent('message.created'));
    const body = (ev.event as { data: { message: { body: string } } }).data.message.body;
    expect(body).toBe('We are chasing this with the hub.');
  });

  it('never delivers assignment changes to customer subscribers', async () => {
    const agent = await agentSub('tkt-bp-5');
    const customer = await customerSub('tkt-bp-5');

    await assignTicket(S, 'tkt-bp-5', 'team_lead', 'l1_agent');
    await agent.next(isEvent('ticket.assignment_changed')); // agents do receive it

    await addAgentReply(S, 'tkt-bp-5', 'l1_agent', 'A quick update for you.');
    // The customer's first event is the public reply, not the assignment change.
    const ev = await customer.next(isEvent('message.created'));
    expect((ev.event as { data: { message: { body: string } } }).data.message.body).toBe('A quick update for you.');
  });
});

describe('typing', () => {
  it('relays typing.started/stopped between two agents', async () => {
    const a = await agentSub('tkt-seed-5', 'l1_agent');
    const b = await agentSub('tkt-seed-5', 'team_lead');

    a.send({ t: 'typing', ticketId: 'tkt-seed-5', state: 'start' });
    await b.next(isEvent('typing.started'));

    a.send({ t: 'typing', ticketId: 'tkt-seed-5', state: 'stop' });
    await b.next(isEvent('typing.stopped'));
  });

  it('clears typing when the typer disconnects', async () => {
    const a = await agentSub('tkt-seed-8', 'l1_agent');
    const b = await agentSub('tkt-seed-8', 'team_lead');

    a.send({ t: 'typing', ticketId: 'tkt-seed-8', state: 'start' });
    await b.next(isEvent('typing.started'));

    a.close();
    await b.next(isEvent('typing.stopped'));
  });
});

describe('authorization', () => {
  it('refuses a customer token for a ticket the requester cannot see', () => {
    // tkt-internal-1 is customerVisible:false — no token is ever issued.
    expect(() => mintCustomerToken('default', CUSTOMER, 'tkt-internal-1')).toThrow(/not found/i);
  });

  it('rejects subscribing before authenticating', async () => {
    const s = new Sock();
    open.push(s);
    await s.open();
    s.send({ t: 'subscribe', ticketId: 'tkt-seed-1' });
    const err = await s.next((m) => m.t === 'error');
    expect(err.reason).toBe('not_authenticated');
  });

  it('rejects an invalid connection token and closes', async () => {
    const s = new Sock();
    open.push(s);
    await s.open();
    s.send({ t: 'auth', token: 'not-a-real-token' });
    const err = await s.next((m) => m.t === 'auth_error');
    expect(err.reason).toBe('invalid_token');
  });

  it('confines a customer token to its one ticket', async () => {
    const s = new Sock();
    open.push(s);
    await s.open();
    // Token minted for tkt-bp-1, but the client tries to subscribe to tkt-bp-2.
    s.send({ t: 'auth', token: mintCustomerToken('default', CUSTOMER, 'tkt-bp-1').token });
    await s.next((m) => m.t === 'auth_ok');
    s.send({ t: 'subscribe', ticketId: 'tkt-bp-2' });
    const err = await s.next((m) => m.t === 'sub_error');
    expect(err.reason).toBe('forbidden');
  });
});
