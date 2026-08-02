// When a ticket may be quality-reviewed. Pure, no I/O — imported by the browser
// (to hide/disable the review actions) AND by the mock server (to refuse them),
// so the button a supervisor sees and the rule the server enforces can never
// drift apart. The server is the control; the UI is the convenience.
//
// A quality review is an assessment of how an agent handled a ticket, so it only
// means anything once the handling is FINISHED. Reviewing a ticket that is still
// being worked grades an unfinished job — the agent has not had their chance to
// close it out, and any finding could be answered by the next reply.
import type { Ticket, TicketStatus } from '../models/ticket';

/**
 * The end states a ticket may be reviewed in. `resolved` is the ordinary one;
 * `closed` is included because it is a real ticket status that a resolved ticket
 * moves on to — a review must not become impossible simply because the ticket
 * was finalized afterwards.
 */
export const REVIEW_ELIGIBLE_STATUSES: readonly TicketStatus[] = ['resolved', 'closed'];

/**
 * Shown wherever a review action is blocked, and thrown by the server when one
 * is attempted anyway. One sentence, one place: the supervisor is told the same
 * thing whether the UI stopped them or the API did.
 */
export const REVIEW_BLOCKED_MESSAGE = 'Resolve the ticket before reviewing it.';

/**
 * Whether this ticket is in an end state a review may be written against.
 *
 * Reopening is an EVENT, not a status (see server/tickets.ts): a reopened ticket
 * is back on `open` / `in_progress`, so this returns false for it — which is the
 * intent. Its earlier reviews are untouched and still readable; only NEW review
 * work is blocked while the ticket is active again.
 */
export function isReviewEligible(ticket: Pick<Ticket, 'status'>): boolean {
  return REVIEW_ELIGIBLE_STATUSES.includes(ticket.status);
}
