import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { IconSearch } from '@tabler/icons-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/** Search input that navigates to the help search results page on submit. */
export function HelpSearchBox({ initialQuery = '', autoFocus = false }: { initialQuery?: string; autoFocus?: boolean }) {
  const [value, setValue] = useState(initialQuery);
  const navigate = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) navigate(`/help/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={onSubmit} role="search" className="flex w-full gap-2">
      <div className="relative flex-1">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          aria-label="Search the help center"
          placeholder="Search for help…"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => setValue(e.target.value)}
          className="pl-10"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
