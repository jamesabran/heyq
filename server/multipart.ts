/**
 * multipart — a minimal `multipart/form-data` parser for the no-framework Node
 * API (server/http.ts). It exists so attachment uploads can arrive as real
 * multipart requests (the contract the Business+ + agent clients use) without
 * pulling in a body-parsing dependency or a web framework.
 *
 * It is deliberately small: it reads the whole body into memory (uploads are
 * capped at a few files of ≤10 MB by the attachment policy), splits on the
 * boundary, and separates plain text fields from file parts. It does not stream —
 * that is fine for the mock stage and keeps the surface auditable.
 */
import type { IncomingMessage } from 'node:http';

export interface MultipartFile {
  /** Form field name the file was sent under (e.g. "files"). */
  field: string;
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface MultipartBody {
  fields: Record<string, string>;
  files: MultipartFile[];
}

/** A hard cap so a malformed/hostile request can't exhaust memory. */
const MAX_BODY_BYTES = 60 * 1024 * 1024; // 5 files × 10 MB + form overhead headroom

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Upload is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function boundaryOf(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  const value = match?.[1] ?? match?.[2];
  return value ? value.trim() : null;
}

/** Parse the `Content-Disposition` header of one part into name + filename. */
function parseDisposition(header: string): { name?: string; filename?: string } {
  const name = /name="([^"]*)"/i.exec(header)?.[1];
  const filename = /filename="([^"]*)"/i.exec(header)?.[1];
  return { name, filename };
}

/**
 * Parse a multipart/form-data request. Returns text fields and file parts.
 * Throws when the request is not multipart or the boundary is missing.
 */
export async function parseMultipart(req: IncomingMessage): Promise<MultipartBody> {
  const contentType = req.headers['content-type'];
  if (!contentType || !/multipart\/form-data/i.test(contentType)) {
    throw new Error('Expected multipart/form-data request.');
  }
  const boundary = boundaryOf(contentType);
  if (!boundary) throw new Error('Malformed multipart request: no boundary.');

  const body = await readRawBody(req);
  const delimiter = Buffer.from(`--${boundary}`);

  const fields: Record<string, string> = {};
  const files: MultipartFile[] = [];

  // Split the body on the boundary delimiter. Each segment between delimiters is
  // one part: raw headers, a blank line (CRLF CRLF), then the content.
  let start = body.indexOf(delimiter);
  if (start === -1) return { fields, files };
  start += delimiter.length;

  while (start < body.length) {
    // "--" immediately after a delimiter marks the closing boundary.
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
    // Skip the CRLF after the delimiter.
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;

    const next = body.indexOf(delimiter, start);
    if (next === -1) break;

    // The part content ends with a trailing CRLF before the next delimiter.
    let end = next;
    if (body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2;

    const part = body.subarray(start, end);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString('utf-8');
      const content = part.subarray(headerEnd + 4);

      const dispositionLine = rawHeaders.split('\r\n').find((l) => /content-disposition/i.test(l)) ?? '';
      const { name, filename } = parseDisposition(dispositionLine);
      const typeLine = rawHeaders.split('\r\n').find((l) => /content-type/i.test(l));
      const partType = typeLine ? typeLine.split(':')[1]?.trim() ?? '' : '';

      if (name !== undefined) {
        if (filename !== undefined) {
          // A file part — even an empty filename is skipped (no file chosen).
          if (filename !== '') {
            files.push({ field: name, filename, contentType: partType, data: Buffer.from(content) });
          }
        } else {
          fields[name] = content.toString('utf-8');
        }
      }
    }

    start = next + delimiter.length;
  }

  return { fields, files };
}
