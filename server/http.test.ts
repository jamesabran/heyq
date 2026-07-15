/**
 * Route-protection + CORS policy for the HeyQ mock API (server/http.ts).
 *
 * The boundary under test: GGX Business+ (a CUSTOMER origin) may reach only the
 * `public` customer surface; agent/internal routes are refused. Requests are
 * made with node:http so the `Origin` header can be set explicitly (browser-spec
 * fetch treats Origin as forbidden and would drop it), letting us simulate each
 * kind of caller.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHeyQServer } from './http.ts';

const CUSTOMER_ORIGIN = 'https://ggx-corporate.vercel.app';
const AGENT_ORIGIN = 'https://heyq.vercel.app';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createHeyQServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));

interface Res {
  status: number;
  headers: Record<string, string | string[] | undefined>;
}

/** One raw request, with an optional Origin, returning status + headers. */
function call(method: string, path: string, origin?: string): Promise<Res> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, method, path, headers: origin ? { Origin: origin } : {} },
      (res) => {
        res.resume(); // drain
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

describe('customer origin (GGX Business+)', () => {
  it('reaches the public customer read surface', async () => {
    const res = await call('GET', '/api/customer/tickets', CUSTOMER_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(CUSTOMER_ORIGIN);
  });

  it('reaches public requester reply/reopen (routes exist; 404 is the ticket, not the boundary)', async () => {
    // A missing ticket returns 404 from the handler — crucially NOT 403, proving
    // the customer origin was allowed THROUGH the route protection.
    const reply = await call('POST', '/api/tickets/nope/messages', CUSTOMER_ORIGIN);
    const reopen = await call('POST', '/api/tickets/nope/reopen', CUSTOMER_ORIGIN);
    expect(reply.status).not.toBe(403);
    expect(reopen.status).not.toBe(403);
  });

  it('is refused on agent/internal routes with 403', async () => {
    for (const path of [
      '/api/tickets',
      '/api/tickets/t1/detail',
      '/api/notifications?recipientId=x',
      '/api/reports/summary',
      '/api/audit/tickets',
    ]) {
      const res = await call('GET', path, CUSTOMER_ORIGIN);
      expect(res.status, `${path} must be refused for a customer origin`).toBe(403);
    }
  });
});

describe('agent origin (HeyQ frontend)', () => {
  it('reaches agent/internal routes', async () => {
    const res = await call('GET', '/api/tickets', AGENT_ORIGIN);
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe(AGENT_ORIGIN);
  });
});

describe('server-to-server / tooling (no Origin)', () => {
  it('reaches internal routes — the boundary keys on a known customer origin only', async () => {
    const res = await call('GET', '/api/tickets');
    expect(res.status).toBe(200);
  });
});
