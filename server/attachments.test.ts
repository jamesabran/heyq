/**
 * Attachment upload / validation / authorization / download for the HeyQ mock API
 * (server/attachments.ts + the routes in server/http.ts).
 *
 * HeyQ owns attachments end to end, so this is where the security-critical rules
 * are proven: the extension+MIME allowlist, the 5-file and 10-MB caps, double
 * extensions, blocked types, ticket-level authorization on upload/download, atomic
 * partial-failure handling (no orphaned message or record), and the download
 * headers (attachment-by-default, nosniff, inline only for images/PDFs).
 *
 * Requests go over node:http (as in http.test.ts) — the suite runs under jsdom,
 * whose fetch cannot stream a multipart File body, so multipart requests are built
 * as raw buffers here.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHeyQServer } from './http.ts';

let server: Server;
let port: number;

const IDENTITY = { externalUserId: 'max@email.com', externalOrgId: 'main' };
const OTHER = { externalUserId: 'someone@else.com', externalOrgId: 'other-org' };
const AGENT_ID = 'l1_agent';

beforeAll(async () => {
  server = createHeyQServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));

// ── raw request helper ─────────────────────────────────────────────────────

interface AttachmentRecord {
  id: string;
  messageId?: string;
  uploaderType: string;
  storedName: string;
  originalName: string;
}
interface MessageRecord { id: string; attachments?: AttachmentRecord[] }
interface TicketRecord { id: string; messages: MessageRecord[] }

interface Res {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
  json: <T = unknown>() => T;
  text: () => string;
}

function call(method: string, path: string, opts: { body?: Buffer; contentType?: string } = {}): Promise<Res> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (opts.body) {
      headers['Content-Type'] = opts.contentType ?? 'application/octet-stream';
      headers['Content-Length'] = String(opts.body.length);
    }
    const req = httpRequest({ host: '127.0.0.1', port, method, path, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body,
          json: <T = unknown>() => JSON.parse(body.toString('utf-8')) as T,
          text: () => body.toString('utf-8'),
        });
      });
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ── multipart builder ──────────────────────────────────────────────────────

interface FilePart { name: string; type: string; data: Buffer }
const asFile = (name: string, type: string, bytes: Uint8Array | string = 'hello'): FilePart => ({
  name, type, data: Buffer.from(typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes),
});

function multipart(fields: Record<string, string>, files: FilePart[] = []): { body: Buffer; contentType: string } {
  const boundary = `----heyqtest${Math.random().toString(36).slice(2)}`;
  const parts: Buffer[] = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  for (const f of files) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`));
    parts.push(f.data);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function createTicket(uploads: FilePart[] = []): Promise<{ id: string; body: TicketRecord }> {
  const { body, contentType } = multipart(
    {
      ...IDENTITY,
      name: 'Max Corp Admin',
      email: IDENTITY.externalUserId,
      concernType: 'delivery_delay',
      subject: 'Parcel delayed',
      description: 'Not moving.',
    },
    uploads,
  );
  const res = await call('POST', '/api/customer/tickets', { body, contentType });
  const parsed = res.json<TicketRecord>();
  return { id: parsed.id, body: parsed };
}

async function reply(id: string, files: FilePart[], text = 'x'): Promise<Res> {
  const { body, contentType } = multipart({ body: text }, files);
  return call('POST', `/api/tickets/${id}/messages`, { body, contentType });
}

const q = (id: string, extra = '') =>
  `/api/customer/tickets/${id}${extra}?externalUserId=${IDENTITY.externalUserId}&externalOrgId=${IDENTITY.externalOrgId}`;
const listAttachments = async (id: string): Promise<AttachmentRecord[]> => (await call('GET', q(id, '/attachments'))).json<AttachmentRecord[]>();

// ── ticket creation with attachments ─────────────────────────────────────────

describe('ticket creation with attachments', () => {
  it('stores creation files on the initial message and in the consolidated list', async () => {
    const { id, body } = await createTicket([asFile('receipt.pdf', 'application/pdf'), asFile('photo.png', 'image/png')]);
    const first = body.messages[0];
    expect(first.attachments).toHaveLength(2);
    expect(first.attachments![0].id).toBeTruthy();

    const list = await listAttachments(id);
    expect(list).toHaveLength(2);
    expect(list.every((a) => a.messageId === first.id)).toBe(true);
    // Object key is server-generated, never the original filename (no traversal surface).
    expect(list.every((a) => a.storedName !== a.originalName && !a.storedName.includes('/'))).toBe(true);
  });
});

// ── requester + agent replies with attachments ──────────────────────────────

describe('conversation replies with attachments', () => {
  it('requester reply attaches files that appear on the message and list', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('proof.jpg', 'image/jpeg')], 'Here is proof');
    expect(res.status).toBe(200);
    const msg = res.json<MessageRecord>();
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments![0].id).toBeTruthy();

    const list = await listAttachments(id);
    expect(list.some((a) => a.messageId === msg.id && a.uploaderType === 'requester')).toBe(true);
  });

  it('agent reply attaches files (uploaderType agent) and reaches the consolidated list', async () => {
    const { id } = await createTicket();
    const { body, contentType } = multipart({ agentId: AGENT_ID, body: 'See attached label' }, [asFile('label.pdf', 'application/pdf')]);
    const res = await call('POST', `/api/tickets/${id}/agent-reply`, { body, contentType });
    expect(res.status).toBe(200);
    expect(res.json<MessageRecord>().attachments).toHaveLength(1);

    const list = await listAttachments(id);
    expect(list.some((a) => a.uploaderType === 'agent')).toBe(true);
  });

  it('supports multiple valid files in one reply', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('a.png', 'image/png'), asFile('b.jpg', 'image/jpeg'), asFile('c.txt', 'text/plain')], 'batch');
    expect(res.status).toBe(200);
    expect(res.json<MessageRecord>().attachments).toHaveLength(3);
  });
});

// ── validation ───────────────────────────────────────────────────────────────

describe('validation rejects unsafe or oversized batches', () => {
  it('rejects more than 5 files', async () => {
    const { id } = await createTicket();
    const res = await reply(id, Array.from({ length: 6 }, (_, i) => asFile(`f${i}.png`, 'image/png')));
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/maximum of 5/i);
  });

  it('rejects a file larger than 10 MB', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('big.pdf', 'application/pdf', new Uint8Array(10 * 1024 * 1024 + 1))]);
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/10 MB/i);
  });

  it('rejects a blocked extension (.exe)', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('malware.exe', 'application/octet-stream')]);
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/not allowed/i);
  });

  it('rejects a MIME/extension mismatch', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('photo.png', 'application/x-msdownload')]);
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/doesn.t match/i);
  });

  it('rejects a misleading double extension (payload.exe.pdf)', async () => {
    const { id } = await createTicket();
    const res = await reply(id, [asFile('payload.exe.pdf', 'application/pdf')]);
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/double extension/i);
  });

  it('rejects a password-protected zip', async () => {
    const { id } = await createTicket();
    const enc = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x01, 0x00, 0, 0, 0, 0]);
    const res = await reply(id, [asFile('secret.zip', 'application/zip', enc)]);
    expect(res.status).toBe(400);
    expect(res.json<{error:string}>().error).toMatch(/password-protected/i);
  });

  it('does NOT create an orphaned message or attachment record on a rejected batch', async () => {
    const { id } = await createTicket();
    const before = (await call('GET', q(id))).json<TicketRecord>();
    const beforeAtt = await listAttachments(id);

    const res = await reply(id, [asFile('ok.png', 'image/png'), asFile('bad.exe', 'application/octet-stream')]);
    expect(res.status).toBe(400);

    const after = (await call('GET', q(id))).json<TicketRecord>();
    const afterAtt = await listAttachments(id);
    expect(after.messages).toHaveLength(before.messages.length); // no message created
    expect(afterAtt).toHaveLength(beforeAtt.length);             // no records — not even the valid file
  });
});

// ── authorization + download ─────────────────────────────────────────────────

describe('authorization and download', () => {
  it('serves an authorized download with attachment disposition + nosniff by default', async () => {
    const { id, body } = await createTicket([asFile('receipt.pdf', 'application/pdf', 'PDFDATA')]);
    const attId = body.messages[0].attachments![0].id;
    const res = await call('GET', q(id, `/attachments/${attId}`));
    expect(res.status).toBe(200);
    expect(String(res.headers['content-disposition'])).toMatch(/^attachment; filename=/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text()).toBe('PDFDATA');
  });

  it('renders inline only when requested AND previewable', async () => {
    const { id, body } = await createTicket([asFile('receipt.pdf', 'application/pdf')]);
    const attId = body.messages[0].attachments![0].id;
    const inline = await call('GET', q(id, `/attachments/${attId}`) + '&disposition=inline');
    expect(String(inline.headers['content-disposition'])).toMatch(/^inline; filename=/);
  });

  it('refuses download to an unauthorized requester (404, no info leak)', async () => {
    const { id, body } = await createTicket([asFile('receipt.pdf', 'application/pdf')]);
    const attId = body.messages[0].attachments![0].id;
    const url = `/api/customer/tickets/${id}/attachments/${attId}?externalUserId=${OTHER.externalUserId}&externalOrgId=${OTHER.externalOrgId}`;
    expect((await call('GET', url)).status).toBe(404);
  });

  it('cannot fetch another ticket’s attachment id through a ticket you can see', async () => {
    const a = await createTicket([asFile('a.pdf', 'application/pdf')]);
    const b = await createTicket([asFile('b.pdf', 'application/pdf')]);
    const bAttId = b.body.messages[0].attachments![0].id;
    // Ask for ticket A but pass ticket B's attachment id — must not resolve.
    const res = await call('GET', q(a.id, `/attachments/${bAttId}`));
    expect(res.status).toBe(404);
  });
});
