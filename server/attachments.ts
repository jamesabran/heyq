/**
 * attachments — the server-owned upload store, validation, and authorization for
 * ticket/conversation files. HeyQ owns attachments end to end (product ownership:
 * "HeyQ owns … attachments"); Business+ and the agent app only ever hold metadata
 * and download through the authorized endpoints here.
 *
 * ── Storage ──────────────────────────────────────────────────────────────────
 * The leanest storage the mock stage already uses is in-memory, per store. File
 * BYTES live in a module-level map keyed by `${storeId}::${storedName}`, separate
 * from the seed state (which is structuredClone-copied and must stay plain-JSON).
 * File METADATA lives in the store's `attachments` array. `storedName` is a safe,
 * server-generated object key — the original filename is NEVER used as a path, so
 * there is no path traversal surface. Swapping this map for S3/GCS later touches
 * only `putBlob`/`getBlob`; nothing else changes.
 *
 * ── Validation ───────────────────────────────────────────────────────────────
 * The shared policy (src/app/lib/attachmentPolicy.ts) is enforced HERE over the
 * actual bytes — extension+MIME allowlist, per-file 10 MB cap, ≤5 files, double
 * extensions, and encrypted-archive rejection. The browser's `accept` attribute
 * is never trusted.
 */
import { makeId, nowIso } from '../src/app/lib/mock.ts';
import {
  MAX_FILES_PER_SUBMISSION,
  isEncryptedZip,
  isPreviewable,
  validateCandidate,
} from '../src/app/lib/attachmentPolicy.ts';
import type { AttachmentUploaderType, MockAttachment, TicketAttachment } from '../src/app/models/ticket.ts';
import { getStore, onStoreReset } from './store.ts';

/** One file received for upload: the client name/type plus the actual bytes. */
export interface UploadFile {
  filename: string;
  contentType: string;
  data: Buffer;
}

/** A per-file validation failure, returned so the client can label each file. */
export interface FileError {
  name: string;
  error: string;
}

/** Thrown when validation fails; carries per-file errors and nothing is stored. */
export class AttachmentValidationError extends Error {
  constructor(public readonly errors: FileError[]) {
    super(errors.map((e) => e.error).join(' '));
    this.name = 'AttachmentValidationError';
  }
}

// ── Byte store (module-level; not part of the cloned seed state) ──────────────

const blobs = new Map<string, Buffer>();
const blobKey = (storeId: string, storedName: string) => `${storeId}::${storedName}`;

function putBlob(storeId: string, storedName: string, data: Buffer): void {
  blobs.set(blobKey(storeId, storedName), data);
}
function getBlob(storeId: string, storedName: string): Buffer | undefined {
  return blobs.get(blobKey(storeId, storedName));
}

/** Test/reset affordance — drop a store's bytes so a fresh seed starts clean. */
export function clearAttachmentBlobs(storeId: string): void {
  for (const key of [...blobs.keys()]) {
    if (key.startsWith(`${storeId}::`)) blobs.delete(key);
  }
}

// A store reset (tests, demo reset endpoint) also drops that store's file bytes.
onStoreReset(clearAttachmentBlobs);

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a batch of uploads against the shared policy AND the bytes. Returns the
 * batch untouched on success, or throws AttachmentValidationError with per-file
 * detail. Nothing is stored here — validation is a pure gate the HTTP handler runs
 * BEFORE any message/ticket is created, so a bad batch can never half-create.
 *
 * @param existingCount files already attached in the same logical submission
 *        (so the 5-file cap counts the whole submission, not just this request).
 */
export function validateUploads(files: UploadFile[], existingCount = 0): void {
  const errors: FileError[] = [];

  if (files.length === 0) {
    throw new AttachmentValidationError([{ name: '', error: 'No files were provided.' }]);
  }
  if (existingCount + files.length > MAX_FILES_PER_SUBMISSION) {
    errors.push({
      name: '',
      error: `Too many files — a maximum of ${MAX_FILES_PER_SUBMISSION} files may be attached.`,
    });
  }

  for (const f of files) {
    const candidate = { name: f.filename, size: f.data.length, type: f.contentType };
    const policyError = validateCandidate(candidate);
    if (policyError) {
      errors.push({ name: f.filename, error: policyError });
      continue;
    }
    // Byte-level: reject password-protected/encrypted archives (can't be scanned).
    if (isEncryptedZip(f.data)) {
      errors.push({ name: f.filename, error: `${f.filename}: password-protected archives are not allowed.` });
    }
  }

  if (errors.length > 0) throw new AttachmentValidationError(errors);
}

// ── Persistence (assumes validateUploads already passed) ─────────────────────

export interface PersistInput {
  ticketId: string;
  /** The message this batch belongs to (creation description or a reply). */
  messageId?: string;
  uploaderType: AttachmentUploaderType;
  uploaderId: string;
  files: UploadFile[];
}

/**
 * Store a validated batch: write bytes under a fresh safe key and push one
 * metadata record per file. Returns the created records. Because validation ran
 * first, this never rejects — so a message + its attachments are created together.
 */
export function persistUploads(storeId: string, input: PersistInput): TicketAttachment[] {
  const store = getStore(storeId);
  const now = nowIso();
  const records: TicketAttachment[] = [];

  for (const f of input.files) {
    const storedName = makeId('obj'); // safe server key — NEVER the original name
    putBlob(storeId, storedName, f.data);
    const record: TicketAttachment = {
      id: makeId('att'),
      ticketId: input.ticketId,
      messageId: input.messageId,
      uploaderType: input.uploaderType,
      uploaderId: input.uploaderId,
      originalName: f.filename,
      storedName,
      mimeType: f.contentType,
      size: f.data.length,
      uploadedAt: now,
    };
    store.attachments.push(record);
    records.push(record);
  }
  return records;
}

/** Metadata as carried on a message payload (id lets clients build a download URL). */
export function toMessageAttachment(record: TicketAttachment): MockAttachment {
  return { id: record.id, name: record.originalName, size: record.size, type: record.mimeType };
}

// ── Reads / authorization helpers ────────────────────────────────────────────

/** Every attachment on a ticket (consolidated, newest first). */
export function listTicketAttachments(storeId: string, ticketId: string): TicketAttachment[] {
  return getStore(storeId)
    .attachments.filter((a) => a.ticketId === ticketId)
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export interface ResolvedAttachment {
  record: TicketAttachment;
  bytes: Buffer;
}

/**
 * Resolve one attachment BY ITS OWN id, but only within the named ticket — so a
 * caller authorized for ticket A can never read ticket B's file by guessing an id.
 * Returns null when the attachment doesn't exist, isn't on this ticket, or its
 * bytes are missing.
 */
export function getAttachmentForTicket(
  storeId: string,
  ticketId: string,
  attachmentId: string,
): ResolvedAttachment | null {
  const record = getStore(storeId).attachments.find((a) => a.id === attachmentId && a.ticketId === ticketId);
  if (!record) return null;
  const bytes = getBlob(storeId, record.storedName);
  if (!bytes) return null;
  return { record, bytes };
}

// ── Download headers ─────────────────────────────────────────────────────────

/** Strip path separators and control chars from a name used in a header. */
export function sanitizeDownloadName(name: string): string {
  return name
    .replace(/[\\/]/g, '_')       // no path separators — prevents traversal in the name
    .replace(/[\r\n"]/g, '_')      // no header injection / quote breakout
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '_') // no control characters
    .trim() || 'download';
}

/**
 * Response headers for serving an attachment. Files are served as ATTACHMENTS by
 * default; inline rendering is offered ONLY for validated images/PDFs and only
 * when explicitly requested. `X-Content-Type-Options: nosniff` is always set so a
 * browser can't re-interpret the bytes as something executable.
 */
export function downloadHeaders(record: TicketAttachment, wantInline: boolean): Record<string, string> {
  const inline = wantInline && isPreviewable(record.mimeType);
  const disposition = inline ? 'inline' : 'attachment';
  const safeName = sanitizeDownloadName(record.originalName);
  return {
    'Content-Type': record.mimeType || 'application/octet-stream',
    'Content-Length': String(record.size),
    'Content-Disposition': `${disposition}; filename="${safeName}"`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  };
}
