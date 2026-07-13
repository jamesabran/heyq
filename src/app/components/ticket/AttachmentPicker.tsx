import { useRef, useState } from 'react';
import { IconPaperclip, IconX } from '@tabler/icons-react';
import type { MockAttachment } from '../../models/ticket';
import { Button } from '../ui/Button';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'application/pdf'];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Collects attachment METADATA only (name/size/type) with client-side validation.
 * No upload or storage — the file bytes are never read or sent (mock MVP).
 */
export function AttachmentPicker({
  value,
  onChange,
}: {
  value: MockAttachment[];
  onChange: (next: MockAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');

  function onPick(files: FileList | null) {
    if (!files) return;
    const accepted: MockAttachment[] = [];
    let rejected = '';
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        rejected = `${file.name}: unsupported type. Use PNG, JPG, GIF, or PDF.`;
        continue;
      }
      if (file.size > MAX_BYTES) {
        rejected = `${file.name}: too large (max 5 MB).`;
        continue;
      }
      accepted.push({ name: file.name, size: file.size, type: file.type });
    }
    setError(rejected);
    if (accepted.length) onChange([...value, ...accepted]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ALLOWED.join(',')}
        className="hidden"
        onChange={(e) => onPick(e.target.files)}
      />
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => inputRef.current?.click()}>
        <IconPaperclip size={16} /> Add attachments
      </Button>

      {value.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {value.map((a, i) => (
            <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-sm">
              <span className="truncate text-foreground">{a.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                <button type="button" onClick={() => remove(i)} aria-label={`Remove ${a.name}`} className="text-muted-foreground hover:text-destructive">
                  <IconX size={14} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
