import { Link } from 'react-router';
import { AgentQueuePage } from './AgentQueuePage';
import { PageHeader } from '../../components/layout/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';

export function MyQueue() {
  return <AgentQueuePage queue="mine" title="My Queue" subtitle="Tickets assigned to you." />;
}

export function TeamTickets() {
  return <AgentQueuePage queue="team" title="Team Tickets" subtitle="Tickets for your team's queue." />;
}

export function UnassignedQueue() {
  return <AgentQueuePage queue="unassigned" title="Unassigned" subtitle="Tickets waiting to be claimed." />;
}

export function EscalatedQueue() {
  return (
    <AgentQueuePage
      queue="escalated"
      title="Escalated Tickets"
      subtitle="Filtered by escalation state — independent of workflow status."
    />
  );
}

export function SlaQueue() {
  return <AgentQueuePage queue="sla" title="SLA At-Risk" subtitle="Tickets at risk of or breaching SLA." />;
}

export function AgentSearch() {
  return <AgentQueuePage queue="all" title="Search" subtitle="Search across all tickets you can see." />;
}

const PRESET_VIEWS = [
  { to: '/app/mine', label: 'My Queue', desc: 'Assigned to me' },
  { to: '/app/team', label: 'Team Tickets', desc: "My team's queue" },
  { to: '/app/unassigned', label: 'Unassigned', desc: 'Waiting to be claimed' },
  { to: '/app/escalated', label: 'Escalated', desc: 'By escalation state' },
  { to: '/app/sla', label: 'SLA At-Risk', desc: 'At risk or breached' },
  // Reopened is a flag, not a status, so it has no place in the status filter —
  // this is its entry point outside the Overview counter.
  { to: '/app/team?reopened=1', label: 'Reopened', desc: 'Came back after resolution' },
  { to: '/app/team?status=on_hold', label: 'On Hold', desc: 'Blocked, with a reason' },
];

export function SavedViews() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Saved Views" subtitle="Quick access to standard queues." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRESET_VIEWS.map((v) => (
          <Link key={v.to} to={v.to} className="group block focus-visible:outline-none">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground group-hover:text-primary">{v.label}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
