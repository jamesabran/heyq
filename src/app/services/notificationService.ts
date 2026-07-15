/**
 * notificationService — thin HTTP client over server/notifications.ts.
 *
 * `emit` now happens server-side, inline inside the ticket lifecycle functions
 * (server/tickets.ts) — there is nothing left for the browser to call to fire
 * a notification. This file only reads/manages the feed.
 *
 * Endpoints:
 *   GET  /notifications?recipientId=      → listForRecipient
 *   GET  /notifications/unread-count      → unreadCount
 *   POST /notifications/:id/read          → markRead
 *   POST /notifications/read-all          → markAllRead
 *   GET  /notification-prefs              → getMutedEvents
 *   PUT  /notification-prefs              → setEventMuted
 */
import type { Notification, NotificationEvent } from '../models/notification';
import { apiGet, apiPost, apiPut, buildQuery } from '../lib/apiClient';

export async function listForRecipient(recipientId: string): Promise<Notification[]> {
  return apiGet<Notification[]>(`/notifications${buildQuery({ recipientId })}`);
}

export async function unreadCount(recipientId: string): Promise<number> {
  const { count } = await apiGet<{ count: number }>(`/notifications/unread-count${buildQuery({ recipientId })}`);
  return count;
}

export async function markRead(id: string): Promise<void> {
  await apiPost<{ ok: true }>(`/notifications/${id}/read`);
}

export async function markAllRead(recipientId: string): Promise<void> {
  await apiPost<{ ok: true }>('/notifications/read-all', { recipientId });
}

export async function getMutedEvents(): Promise<NotificationEvent[]> {
  return apiGet<NotificationEvent[]>('/notification-prefs');
}

export async function setEventMuted(event: NotificationEvent, muted: boolean): Promise<void> {
  await apiPut<{ ok: true }>('/notification-prefs', { event, muted });
}
