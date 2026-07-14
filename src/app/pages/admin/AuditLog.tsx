import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  listAuditActors,
  listAuditEntries,
  AUDIT_CATEGORY_LABELS,
  type AuditCategory,
  type AuditEntry,
} from '../../services/auditService';
import { useQuery } from '../../hooks/useQuery';
import { simulatedNowMs } from '../../lib/clock';
import { formatDateTime, formatRelativeTime } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

const CATEGORIES = Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[];

const CATEGORY_VARIANT: Record<AuditCategory, 'default' | 'outline' | 'info' | 'warning'> = {
  ticket: 'default',
  assignment: 'info',
  escalation: 'warning',
  note: 'outline',
  kb: 'info',
};

/**
 * The org-wide activity trail (M20). Read-only, gated to team leads and admins.
 * It records the action, the actor, and the time — internal note *bodies* stay on
 * the ticket (product rule #5).
 */
export function AuditLog() {
  // Filters live in the URL, so an audit view is linkable (same convention as the queues).
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') ?? '') as '' | AuditCategory;
  const actorId = params.get('actor') ?? '';
  const search = params.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const entries = useQuery(
    useCallback(
      () =>
        listAuditEntries({
          category: category || undefined,
          actorId: actorId || undefined,
          search: search || undefined,
        }),
      [category, actorId, search],
    ),
    [category, actorId, search],
  );

  const actors = useQuery(useCallback(() => listAuditActors(), []), []);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Audit Log"
        subtitle="Every status change, assignment, escalation, note, and article revision — newest first."
      />

      {/* Search + filters are one grouped control bar, as on the queues. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Input
          type="search"
          aria-label="Search the audit log"
          placeholder="Search reference, article, actor, action…"
          value={search}
          onChange={(e) => setParam('q', e.target.value)}
          className="min-w-[16rem] flex-1 sm:max-w-md"
        />
        <div className="w-44">
          <Select
            aria-label="Filter by event type"
            value={category}
            onChange={(e) => setParam('category', e.target.value)}
          >
            <option value="">All event types</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{AUDIT_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
        </div>
        <div className="w-44">
          <Select aria-label="Filter by actor" value={actorId} onChange={(e) => setParam('actor', e.target.value)}>
            <option value="">All actors</option>
            {(actors.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {entries.error ? (
        <ErrorState onRetry={entries.refetch} />
      ) : entries.loading ? (
        <LoadingGrid count={3} />
      ) : (entries.data ?? []).length === 0 ? (
        <EmptyState title="No activity matches these filters">
          Try a different event type, actor, or search term.
        </EmptyState>
      ) : (
        <AuditTable entries={entries.data ?? []} />
      )}
    </div>
  );
}

function AuditTable({ entries }: { entries: AuditEntry[] }) {
  const now = simulatedNowMs();

  return (
    // The audit trail is the longest table in the app (every status event ever), so
    // it scrolls inside its own box with a sticky header — same treatment as the
    // ticket queues. Below `md` the Actor column folds into the Action cell.
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-border">
      <table className="w-full min-w-[460px] border-collapse text-sm md:min-w-[720px]">
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium">When</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Actor</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Type</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Subject</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.category}-${e.id}`} className="border-b border-border transition-colors last:border-0 hover:bg-accent/50 focus-within:bg-accent/50">
              <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted-foreground">
                <time dateTime={e.timestamp} title={formatDateTime(e.timestamp)}>
                  {formatRelativeTime(e.timestamp, now)}
                </time>
              </td>
              <td className="hidden px-3 py-2.5 align-top text-foreground md:table-cell">{e.actorName}</td>
              <td className="hidden px-3 py-2.5 align-top sm:table-cell">
                <Badge variant={CATEGORY_VARIANT[e.category]}>{AUDIT_CATEGORY_LABELS[e.category]}</Badge>
              </td>
              <td className="px-3 py-2.5 align-top">
                {e.ticketId ? (
                  <Link to={`/app/tickets/${e.ticketId}`} className="font-medium text-accent-brand hover:underline">
                    {e.ticketRef}
                  </Link>
                ) : e.articleId ? (
                  <Link to={`/admin/kb/${e.articleId}`} className="font-medium text-accent-brand hover:underline">
                    {e.articleTitle}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 align-top text-muted-foreground">
                {e.action}
                {/* Actor is shed above, not lost — it folds in here. */}
                <span className="mt-0.5 block text-xs md:hidden">{e.actorName}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
