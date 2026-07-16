import { test, expect } from '@playwright/test';
import WebSocket from 'ws';

/**
 * Live conversation, end to end: a REAL browser agent viewing a ticket, plus a
 * raw WebSocket + REST "customer" on the same ticket. Proves both directions —
 * a customer reply appears in HeyQ without a refresh, an agent reply is broadcast
 * to the customer channel, and customer typing surfaces in the agent UI.
 */
const API = 'http://localhost:4310';
const TICKET = 'tkt-bp-1';
const CUSTOMER = { externalUserId: 'max@email.com', externalOrgId: 'main' };

async function post(path: string, body: unknown) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** A customer WebSocket subscriber that records the public-message bodies it receives. */
class CustomerSock {
  private ws: WebSocket;
  private bodies: string[] = [];
  private waiters: { body: string; resolve: () => void }[] = [];

  constructor(private token: string) {
    this.ws = new WebSocket(`${API.replace(/^http/, 'ws')}/api/realtime`);
    this.ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.t === 'auth_ok') this.ws.send(JSON.stringify({ t: 'subscribe', ticketId: TICKET }));
      if (m.t === 'event' && m.event.type === 'message.created') {
        const body = m.event.data.message.body as string;
        this.bodies.push(body);
        this.waiters = this.waiters.filter((w) => (w.body === body ? (w.resolve(), false) : true));
      }
    });
  }

  ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => this.ws.send(JSON.stringify({ t: 'auth', token: this.token })));
      this.ws.on('message', (d) => {
        if (JSON.parse(d.toString()).t === 'subscribed') resolve();
      });
      this.ws.on('error', reject);
    });
  }

  waitFor(body: string, timeout = 8000): Promise<void> {
    if (this.bodies.includes(body)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`customer never received "${body}"`)), timeout);
      this.waiters.push({ body, resolve: () => { clearTimeout(timer); resolve(); } });
    });
  }

  typingStart(): void {
    this.ws.send(JSON.stringify({ t: 'typing', ticketId: TICKET, state: 'start' }));
  }

  close(): void {
    this.ws.close();
  }
}

test('agent and customer exchange live updates on one ticket', async ({ page }, testInfo) => {
  const tag = `${testInfo.project.name}-${Date.now()}`;

  await page.addInitScript((id) => window.localStorage.setItem('heyq-identity', id), 'admin');
  await page.goto(`/app/tickets/${TICKET}`);
  await expect(page.getByRole('heading', { name: 'Conversation' })).toBeVisible();
  // The agent's realtime connection comes up.
  await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 });

  // Customer subscribes over an authorized WebSocket.
  const { token } = await post('/api/customer/realtime/token', { ...CUSTOMER, ticketId: TICKET });
  const sock = new CustomerSock(token);
  await sock.ready();

  // (1) Customer typing → the agent sees a customer-safe indicator, no identity leak.
  sock.typingStart();
  await expect(page.getByText(/requester is typing/i)).toBeVisible({ timeout: 8000 });

  // (2) Customer posts a reply over REST → it appears in HeyQ without a refresh.
  const customerBody = `Customer live message ${tag}`;
  await post(`/api/tickets/${TICKET}/messages`, { body: customerBody });
  await expect(page.getByText(customerBody)).toBeVisible({ timeout: 10000 });

  // (3) Agent replies in the UI → the reply is broadcast to the customer channel.
  const agentBody = `Agent live reply ${tag}`;
  await page.getByLabel('Public reply').fill(agentBody);
  await page.getByRole('button', { name: /send reply/i }).click();
  await sock.waitFor(agentBody);

  sock.close();
});
