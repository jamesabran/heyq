// The realtime event contract — ONE definition shared by the server broadcaster
// (server/realtime.ts) and the browser client (lib/realtimeClient.ts), so the
// two can never drift. No runtime deps: pure types plus the customer-safe field
// list, importable from either side.
import type { CustomerTicketMessage, InternalNote, TicketMessage, TicketStatus, HoldReason } from './ticket';

export type RealtimeEventType =
  | 'message.created'
  | 'ticket.status_changed'
  | 'ticket.assignment_changed'
  | 'typing.started'
  | 'typing.stopped';

/** Who caused the event. Customer clients only ever see these three. */
export type ActorType = 'agent' | 'requester' | 'system';

/** message.created payload as delivered to AGENT subscribers. */
export type AgentMessageData =
  | { messageKind: 'public'; message: TicketMessage }
  | { messageKind: 'internal_note'; note: InternalNote };

/** message.created payload as delivered to CUSTOMER subscribers (projected). */
export interface CustomerMessageData {
  messageKind: 'public';
  message: CustomerTicketMessage;
}

export interface StatusChangedData {
  status: TicketStatus;
  holdReason?: HoldReason;
  fromStatus?: TicketStatus;
}

export interface AssignmentChangedData {
  assigneeId?: string;
  assigneeName?: string;
  teamId: string;
  teamName: string;
}

export interface TypingData {
  /** Customer-safe display label, e.g. "Requester" or "Support". */
  label: string;
}

/**
 * The envelope every event is wrapped in. `id` is stable for de-duplication and
 * `serverTimestamp` is authoritative for ordering. `data` is narrowed by `type`
 * and by the subscriber's audience (agents vs customers get different shapes for
 * message.created; assignment_changed is never sent to customers at all).
 */
export interface RealtimeEvent<TData = unknown> {
  id: string;
  type: RealtimeEventType;
  ticketId: string;
  actorType: ActorType;
  serverTimestamp: string;
  data: TData;
}

/**
 * Fields a CUSTOMER client may safely read off realtime payloads. Documented here
 * so the Business+ integration has a single, checkable allow-list. Anything not
 * listed (agent identity, internal notes, assignee, team routing internals, SLA)
 * is never emitted on a customer channel.
 */
export const CUSTOMER_SAFE_MESSAGE_FIELDS = ['id', 'from', 'authorLabel', 'body', 'attachments', 'createdAt'] as const;
