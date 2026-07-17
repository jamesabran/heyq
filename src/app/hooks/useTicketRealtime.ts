import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InternalNote, MockAttachment, TicketMessage } from '../models/ticket';
import type { AgentMessageData, RealtimeEvent, TypingData } from '../models/realtime';
import { addAgentReply, addAgentReplyWithFiles, addInternalNote } from '../services/ticketService';
import { getAgentRealtimeToken } from '../services/realtimeService';
import {
  openTicketChannel,
  realtimeSupported,
  type RealtimeStatus,
  type TicketChannel,
} from '../lib/realtimeClient';
import { makeId } from '../lib/mock';

/** An agent reply/note not yet confirmed by the server — rendered optimistically. */
export interface PendingReply {
  tempId: string;
  kind: 'reply' | 'note';
  body: string;
  /** Display metadata for the optimistic bubble. */
  attachments?: MockAttachment[];
  /** Real files to (re)upload — replies upload bytes; notes stay metadata-only. */
  files?: File[];
  status: 'sending' | 'failed';
  createdAt: string;
}

/** Optimistic display metadata for a staged file (no id until the server stores it). */
const toMeta = (files?: File[]): MockAttachment[] | undefined =>
  files?.length ? files.map((f) => ({ name: f.name, size: f.size, type: f.type })) : undefined;

const byCreatedThenId = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const TYPING_CLEAR_MS = 5000;
const TYPING_THROTTLE_MS = 2000;
const OFFLINE_POLL_MS = 8000;

interface Args {
  ticketId: string;
  agentId: string;
  /** Authoritative messages/notes from the detail query (source of truth). */
  baseMessages: TicketMessage[];
  baseNotes: InternalNote[];
  /** Refetch the ticket detail — used on reconnect, status/assignment events, and as the offline fallback. */
  refetchDetail: () => void;
}

/**
 * Live conversation for the agent ticket view. The detail query stays the source
 * of truth; this hook overlays live `message.created` events (de-duplicated by
 * id), renders optimistic sends with a retry state, tracks the typing indicator,
 * exposes connection status, refetches on (re)connect to recover missed events,
 * and polls as a fallback while the socket is down. It NEVER surfaces internal
 * notes to anyone but the agent (the server already withholds them from customer
 * channels; here they simply flow into the notes overlay).
 */
export function useTicketRealtime({ ticketId, agentId, baseMessages, baseNotes, refetchDetail }: Args) {
  const [overlayMsg, setOverlayMsg] = useState<Record<string, TicketMessage>>({});
  const [overlayNote, setOverlayNote] = useState<Record<string, InternalNote>>({});
  const [pending, setPending] = useState<PendingReply[]>([]);
  const [connection, setConnection] = useState<RealtimeStatus>(realtimeSupported ? 'connecting' : 'offline');
  const [typing, setTyping] = useState<{ label: string } | null>(null);

  const channelRef = useRef<TicketChannel | null>(null);
  const refetchRef = useRef(refetchDetail);
  refetchRef.current = refetchDetail;
  const pendingRef = useRef<PendingReply[]>(pending);
  pendingRef.current = pending;
  const prevStatusRef = useRef<RealtimeStatus>('offline');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSentRef = useRef(0);
  const seenRef = useRef<Set<string>>(new Set());

  // Switching tickets: drop all live overlay/typing/pending state.
  useEffect(() => {
    setOverlayMsg({});
    setOverlayNote({});
    setPending([]);
    setTyping(null);
    seenRef.current = new Set();
    prevStatusRef.current = 'offline';
  }, [ticketId]);

  // Prune overlay entries once the authoritative refetch includes them.
  useEffect(() => {
    const ids = new Set(baseMessages.map((m) => m.id));
    setOverlayMsg((prev) => pruneKnown(prev, ids));
  }, [baseMessages]);
  useEffect(() => {
    const ids = new Set(baseNotes.map((n) => n.id));
    setOverlayNote((prev) => pruneKnown(prev, ids));
  }, [baseNotes]);

  const handleEvent = useCallback((ev: RealtimeEvent) => {
    if (seenRef.current.has(ev.id)) return; // de-duplicate by event id
    seenRef.current.add(ev.id);
    if (seenRef.current.size > 1000) seenRef.current = new Set([...seenRef.current].slice(-500));

    switch (ev.type) {
      case 'message.created': {
        const data = ev.data as AgentMessageData;
        if (data.messageKind === 'public') {
          setOverlayMsg((prev) => (prev[data.message.id] ? prev : { ...prev, [data.message.id]: data.message }));
        } else {
          setOverlayNote((prev) => (prev[data.note.id] ? prev : { ...prev, [data.note.id]: data.note }));
        }
        break;
      }
      case 'ticket.status_changed':
      case 'ticket.assignment_changed':
        // Authoritative fields live on the ticket — refetch to update the chips,
        // timeline, and any status-driven conversation changes in one place.
        refetchRef.current();
        break;
      case 'typing.started': {
        setTyping({ label: (ev.data as TypingData).label });
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setTyping(null), TYPING_CLEAR_MS);
        break;
      }
      case 'typing.stopped':
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        setTyping(null);
        break;
    }
  }, []);

  // Open the live channel for this ticket.
  useEffect(() => {
    if (!ticketId || !realtimeSupported) {
      setConnection('offline');
      return;
    }
    const channel = openTicketChannel({
      ticketId,
      fetchToken: () => getAgentRealtimeToken(agentId).then((r) => r.token),
      onEvent: handleEvent,
      onStatus: (s) => {
        setConnection(s);
        // Coming (back) online: refetch to recover anything missed while down.
        if (s === 'live' && prevStatusRef.current !== 'live') refetchRef.current();
        prevStatusRef.current = s;
      },
    });
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [ticketId, agentId, handleEvent]);

  // Fallback: while a supported socket is not live, poll the API for updates.
  useEffect(() => {
    if (!realtimeSupported || connection === 'live') return;
    const id = setInterval(() => refetchRef.current(), OFFLINE_POLL_MS);
    return () => clearInterval(id);
  }, [connection]);

  const messages = useMemo(() => {
    const map = new Map<string, TicketMessage>();
    for (const m of baseMessages) map.set(m.id, m);
    for (const m of Object.values(overlayMsg)) map.set(m.id, m);
    return [...map.values()].sort(byCreatedThenId);
  }, [baseMessages, overlayMsg]);

  const notes = useMemo(() => {
    const map = new Map<string, InternalNote>();
    for (const n of baseNotes) map.set(n.id, n);
    for (const n of Object.values(overlayNote)) map.set(n.id, n);
    return [...map.values()].sort(byCreatedThenId);
  }, [baseNotes, overlayNote]);

  const runSend = useCallback(
    async (kind: 'reply' | 'note', tempId: string, body: string, files?: File[]) => {
      try {
        if (kind === 'reply') {
          // A reply with files is a real multipart upload (bytes stored + linked);
          // a text-only reply stays the lean JSON path.
          const msg = files?.length
            ? await addAgentReplyWithFiles(ticketId, agentId, body, files)
            : await addAgentReply(ticketId, agentId, body);
          setOverlayMsg((prev) => ({ ...prev, [msg.id]: msg }));
        } else {
          // Internal notes keep the metadata-only path (agent-only, never uploaded).
          const n = await addInternalNote(ticketId, agentId, body, toMeta(files));
          setOverlayNote((prev) => ({ ...prev, [n.id]: n }));
        }
        setPending((p) => p.filter((x) => x.tempId !== tempId));
      } catch {
        setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: 'failed' } : x)));
      }
    },
    [ticketId, agentId],
  );

  const send = useCallback(
    async (kind: 'reply' | 'note', body: string, files?: File[]) => {
      const tempId = makeId('tmp');
      setPending((p) => [...p, { tempId, kind, body, files, attachments: toMeta(files), status: 'sending', createdAt: new Date().toISOString() }]);
      channelRef.current?.sendTyping('stop');
      await runSend(kind, tempId, body, files);
    },
    [runSend],
  );

  const sendReply = useCallback((body: string, files?: File[]) => send('reply', body, files), [send]);
  const sendNote = useCallback((body: string, files?: File[]) => send('note', body, files), [send]);

  const retryPending = useCallback(
    (tempId: string) => {
      const item = pendingRef.current.find((x) => x.tempId === tempId);
      if (!item) return;
      setPending((p) => p.map((x) => (x.tempId === tempId ? { ...x, status: 'sending' } : x)));
      runSend(item.kind, tempId, item.body, item.files);
    },
    [runSend],
  );

  const notifyTyping = useCallback((state: 'start' | 'stop') => {
    const ch = channelRef.current;
    if (!ch) return;
    if (state === 'stop') {
      ch.sendTyping('stop');
      return;
    }
    const now = Date.now();
    if (now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      ch.sendTyping('start');
    }
  }, []);

  return {
    messages,
    notes,
    pending,
    connection,
    typingLabel: typing?.label ?? null,
    sendReply,
    sendNote,
    retryPending,
    notifyTyping,
  };
}

function pruneKnown<T>(overlay: Record<string, T>, baseIds: Set<string>): Record<string, T> {
  let changed = false;
  const next: Record<string, T> = {};
  for (const [id, v] of Object.entries(overlay)) {
    if (baseIds.has(id)) changed = true;
    else next[id] = v;
  }
  return changed ? next : overlay;
}
