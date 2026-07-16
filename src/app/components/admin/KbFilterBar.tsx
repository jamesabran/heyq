import { IconSearch } from '@tabler/icons-react';
import type { KbArticleStatus } from '../../models/kb';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

export type StatusFilter = KbArticleStatus | 'all';

export interface KbFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  searchLabel: string;
  placeholder: string;
}

/** Search + draft/published filter, shared by the FAQ and legal admin lists. */
export function KbFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  searchLabel,
  placeholder,
}: KbFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <IconSearch
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={searchLabel}
          placeholder={placeholder}
          className="pl-9"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <Select
        aria-label="Filter by status"
        className="w-40"
        value={status}
        onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
      >
        <option value="all">All statuses</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </Select>
    </div>
  );
}
