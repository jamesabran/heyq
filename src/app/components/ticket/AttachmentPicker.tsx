import { useRef, useState } from 'react';
import { IconPaperclip, IconX } from '@tabler/icons-react';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILES_PER_SUBMISSION,
  formatBytes,
  validateCandidate,
} from '../../lib/attachmentPolicy';
import { Button } from '../ui/Button';

/**
 * Collects REAL files to upload, validated against the shared attachment policy
 * (the same allowlist / size / count / double-extension rules the SERVER enforces
 * — the `accept` attribute below is a convenience, never the security boundary).
 * The parent uploads the bytes on send; this component only gathers + validates.
 */
export function AttachmentPicker({
  value,
  onChange,
  disabled,
}: {
  value: File[];
  onChange: (next: File[]) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);

  function onPick(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const accepted: File[] = [];
    const nextErrors: string[] = [];

    for (const file of incoming) {
      const error = validateCandidate({ name: file.name, size: file.size, type: file.type });
      if (error) { nextErrors.push(error); continue; }
      // Reject a duplicate (same name+size) already staged.
      if ([...value, ...accepted].some((f) => f.name === file.name && f.size === file.size)) continue;
      accepted.push(file);
    }

    const total = value.length + accepted.length;
    if (total > MAX_FILES_PER_SUBMISSION) {
      const room = Math.max(0, MAX_FILES_PER_SUBMISSION - value.length);
      nextErrors.push(`You can attach at most ${MAX_FILES_PER_SUBMISSION} files.`);
      accepted.splice(room); // keep only what fits
    }

    setErrors(nextErrors);
    if (accepted.length) onChange([...value, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
    setErrors([]);
  }

  const accept = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',');

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
        disabled={disabled || value.length >= MAX_FILES_PER_SUBMISSION}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={disabled || value.length >= MAX_FILES_PER_SUBMISSION}
        onClick={() => inputRef.current?.click()}
      >
        <IconPaperclip size={16} /> Add attachments
      </Button>

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((f, i) => (
            <li key={`${f.name}-${f.size}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm">
              <span className="truncate text-foreground">{f.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-destructive" disabled={disabled}>
                  <IconX size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5">
          {errors.map((e, i) => (
            <li key={i} className="text-xs font-medium text-destructive">{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
