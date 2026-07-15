/**
 * notifications — server-side port of src/app/services/notificationService.ts.
 *
 * `emit` is called by server/tickets.ts when core lifecycle events happen. Same
 * behavior as the original client service (mute prefs + short dedup window),
 * just operating on a store (resolved by id) instead of browser module state.
 */
import type { Notification, NotificationEvent } from '../src/app/models/notification.ts';
import { clone, makeId, nowIso, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore } from './store.ts';

const DEDUP_WINDOW_MS = 3000;

export interface EmitInput {
  recipientId: string;
  event: NotificationEvent;
  title: string;
  ticketId?: string;
  ticketRef?: string;
  emailed?: boolean;
}

/** Emit a notification (sync — called from within ticket lifecycle functions). */
export function emit(storeId: string, input: EmitInput): Notification | null {
  const store = getStore(storeId);
  if (store.notificationPrefs.muted.includes(input.event)) return null;

  const now = Date.now();
  const duplicate = store.notifications.find(
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
  store.notifications.unshift(notification);
  return notification;
}

export async function listForRecipient(storeId: string, recipientId: string): Promise<Notification[]> {
  await simulateLatency();
  const store = getStore(storeId);
  return clone(
    store.notifications
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
}

export async function unreadCount(storeId: string, recipientId: string): Promise<number> {
  await simulateLatency();
  const store = getStore(storeId);
  return store.notifications.filter((n) => n.recipientId === recipientId && !n.read).length;
}

export async function markRead(storeId: string, id: string): Promise<void> {
  await simulateLatency();
  const store = getStore(storeId);
  const n = store.notifications.find((x) => x.id === id);
  if (n) n.read = true;
}

export async function markAllRead(storeId: string, recipientId: string): Promise<void> {
  await simulateLatency();
  const store = getStore(storeId);
  store.notifications.filter((n) => n.recipientId === recipientId).forEach((n) => (n.read = true));
}

export async function getMutedEvents(storeId: string): Promise<NotificationEvent[]> {
  await simulateLatency();
  const store = getStore(storeId);
  return [...store.notificationPrefs.muted];
}

export async function setEventMuted(storeId: string, event: NotificationEvent, muted: boolean): Promise<void> {
  await simulateLatency();
  const store = getStore(storeId);
  const set = new Set(store.notificationPrefs.muted);
  if (muted) set.add(event);
  else set.delete(event);
  store.notificationPrefs.muted = [...set];
}
