/**
 * attachmentPolicy — the SINGLE source of truth for what may be attached to a
 * ticket or a conversation message, shared by the browser (client-side hints)
 * and the server (authoritative enforcement, server/attachments.ts).
 *
 * Security posture (docs/product-rules.md; the Business+ attachment spec):
 *   • an explicit ALLOWLIST — never "accept everything" — validated by BOTH file
 *     extension AND declared MIME type, which must agree;
 *   • executables, scripts, active-content web files, compiled binaries, shortcut/
 *     registry files, and macro-enabled Office files are rejected by extension even
 *     if a caller lies about the MIME type;
 *   • misleading double extensions (`invoice.pdf.exe`, `report.exe.pdf`) are
 *     rejected — a blocked/second extension hiding before the visible one never
 *     passes;
 *   • at most 5 files per submission, at most 10 MB per file;
 *   • the browser `accept=""` attribute is a convenience only — it is NOT security;
 *     the same rules run server-side over the actual bytes.
 *
 * This module is pure and dependency-free so it imports cleanly from both a Vite
 * bundle and the Node API server (tsx). Byte-level checks that need the file body
 * (e.g. encrypted-archive detection) live on the server side that has the bytes.
 */

export const MAX_FILES_PER_SUBMISSION = 5;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Allowed extension → the MIME types that legitimately pair with it. */
export const ALLOWED_TYPES: Record<string, readonly string[]> = {
  // Images
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  // Documents
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  csv: ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
  txt: ['text/plain'],
  // Archives
  zip: ['application/zip', 'application/x-zip-compressed', 'multipart/x-zip'],
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_TYPES);

/**
 * Explicitly blocked extensions. Kept as a set so the double-extension check can
 * recognise a dangerous token hidden BEFORE the visible extension. Anything not in
 * ALLOWED is already refused; this list also makes the double-extension detection
 * meaningful and documents the threat model.
 */
export const BLOCKED_EXTENSIONS = new Set<string>([
  // Executables & installers
  'exe', 'msi', 'apk', 'app', 'dmg', 'pkg', 'deb', 'rpm',
  // Scripts
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'sh', 'bash', 'bat', 'cmd', 'ps1',
  'vbs', 'php', 'py', 'rb', 'pl', 'lua',
  // Active-content web files
  'html', 'htm', 'svg', 'xml', 'xhtml',
  // Java & compiled binaries
  'jar', 'class', 'dll', 'so', 'bin', 'com', 'scr',
  // Shortcut / registry
  'lnk', 'url', 'reg',
  // Macro-enabled Office
  'docm', 'xlsm', 'pptm',
]);

/** Every extension token we RECOGNISE — allowed or blocked. Used by the
 * double-extension check to spot a recognised token hiding before the last one. */
const KNOWN_EXTENSIONS = new Set<string>([...ALLOWED_EXTENSIONS, ...BLOCKED_EXTENSIONS]);

/** MIME types that are safe to render INLINE (preview). Everything else downloads. */
const PREVIEWABLE_MIME = new Set<string>([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

export interface AttachmentCandidate {
  name: string;
  size: number;
  type: string;
}

/** Lower-cased dot-segments of a filename, e.g. `a.PDF` → `['a','pdf']`. */
function segments(name: string): string[] {
  return name.trim().toLowerCase().split('.').filter((s) => s.length > 0);
}

/** The final extension of a filename (without the dot), or '' when there is none. */
export function extensionOf(name: string): string {
  const parts = segments(name);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
}

/** Would this file be shown inline (image/PDF) rather than forced to download? */
export function isPreviewable(mime: string): boolean {
  return PREVIEWABLE_MIME.has(mime.toLowerCase());
}

/**
 * A misleading double extension: any dot-segment BEFORE the final one is itself a
 * recognised extension token. Catches `invoice.pdf.exe` (final ext handled by the
 * allowlist too) and, crucially, `payload.exe.pdf` where a blocked token hides in
 * front of an allowed final extension.
 */
export function hasDoubleExtension(name: string): boolean {
  const parts = segments(name);
  if (parts.length < 3) return false; // base + single extension is fine
  const inner = parts.slice(1, parts.length - 1); // between base and final ext
  return inner.some((seg) => KNOWN_EXTENSIONS.has(seg));
}

/**
 * Validate one candidate by NAME/SIZE/TYPE (the checks both client and server can
 * do). Returns a human-readable error, or null when acceptable. Byte-level checks
 * (encrypted archives) are layered on top server-side.
 */
export function validateCandidate(file: AttachmentCandidate): string | null {
  const name = file.name?.trim();
  if (!name) return 'File has no name.';

  if (hasDoubleExtension(name)) {
    return `${name}: suspicious double extension. Rename the file to a single, real extension.`;
  }

  const ext = extensionOf(name);
  if (!ext) return `${name}: no file extension. Add a supported extension.`;

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return `${name}: .${ext} files are not allowed for security reasons.`;
  }
  const allowedMimes = ALLOWED_TYPES[ext];
  if (!allowedMimes) {
    return `${name}: .${ext} files are not supported.`;
  }

  const mime = (file.type || '').toLowerCase();
  // MIME must be present AND consistent with the extension — a mismatch (e.g. an
  // .exe renamed to .png, or a real type that doesn't match the claimed one) fails.
  if (!mime || !allowedMimes.includes(mime)) {
    return `${name}: file type "${file.type || 'unknown'}" doesn't match its .${ext} extension.`;
  }

  if (file.size > MAX_FILE_BYTES) {
    return `${name}: too large (${formatBytes(file.size)}). The limit is 10 MB.`;
  }
  if (file.size <= 0) {
    return `${name}: file is empty.`;
  }
  return null;
}

/** Human-readable size, shared by pickers and lists so units stay consistent. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * A ZIP whose first local-file-header has the "encrypted" general-purpose bit set
 * is password-protected — we refuse those (their contents can't be scanned).
 * Server-only in practice (needs the bytes); safe no-op on a too-short buffer.
 */
export function isEncryptedZip(bytes: Uint8Array): boolean {
  // Local file header signature "PK\x03\x04", then a 2-byte version, then the
  // 2-byte general-purpose flag (little-endian) at offset 6; bit 0 = encrypted.
  if (bytes.length < 8) return false;
  const isZipSig = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
  if (!isZipSig) return false;
  const flags = bytes[6] | (bytes[7] << 8);
  return (flags & 0x1) === 1;
}
