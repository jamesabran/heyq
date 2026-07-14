/**
 * notificationService — in-app notification feed over mock module state.
 *
 * `emit` is called by ticketService when core events happen. It applies:
 *  - preferences: muted event types are dropped,
 *  - dedup: an identical (recipient, event, ticket) within a short window is
 *    collapsed so one event yields one notification.
 *
 * Future API endpoints:
 *   GET  /notifications?recipient   → listForRecipient
 *   POST /notifications/read        → markRead / markAllRead
 *   GET/PUT /notification-prefs     → getMutedEvents / setEventMuted
 */
import { notificationPrefs, notifications } from '../data/notifications';
import type { Notification, NotificationEvent } from '../models/notification';
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';

const DEDUP_WINDOW_MS = 3000;

export interface EmitInput {
  recipientId: string;
  event: NotificationEvent;
  title: string;
  ticketId?: string;
  ticketRef?: string;
  emailed?: boolean;
}

/** Emit a notification (sync — called from within other services). */
export function emit(input: EmitInput): Notification | null {
  if (notificationPrefs.muted.includes(input.event)) return null;

  const now = Date.now();
  const duplicate = notifications.find(
    (n) =>
      n.recipientId === input.recipientId &&
      n.event === input.event &&
      n.ticketId === input.ticketId &&
      now - new Date(n.createdAt).getTime() < DEDUP_WINDOW_MS,
  );
  if (duplicate) return null;

  const notification: Notification = {
    id: makeId('ntf'),
    recipientId: input.recipientId,
    event: input.event,
    title: input.title,
    ticketId: input.ticketId,
    ticketRef: input.ticketRef,
    emailed: input.emailed ?? false,
    read: false,
    createdAt: nowIso(),
  };
  notifications.unshift(notification);
  return notification;
}

export async function listForRecipient(recipientId: string): Promise<Notification[]> {
  await simulateLatency();
  return clone(
    notifications
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function unreadCount(recipientId: string): Promise<number> {
  await simulateLatency();
  return notifications.filter((n) => n.recipientId === recipientId && !n.read).length;
}

export async function markRead(id: string): Promise<void> {
  await simulateLatency();
  const n = notifications.find((x) => x.id === id);
  if (n) n.read = true;
}

export async function markAllRead(recipientId: string): Promise<void> {
  await simulateLatency();
  notifications.filter((n) => n.recipientId === recipientId).forEach((n) => (n.read = true));
}

export async function getMutedEvents(): Promise<NotificationEvent[]> {
  await simulateLatency();
  return [...notificationPrefs.muted];
}

export async function setEventMuted(event: NotificationEvent, muted: boolean): Promise<void> {
  await simulateLatency();
  const set = new Set(notificationPrefs.muted);
  if (muted) set.add(event);
  else set.delete(event);
  notificationPrefs.muted = [...set];
}
