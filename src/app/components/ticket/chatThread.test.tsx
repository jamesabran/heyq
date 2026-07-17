import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatThread } from './ChatThread';
import type { InternalNote, TicketMessage } from '../../models/ticket';
import type { PendingReply } from '../../hooks/useTicketRealtime';

const msg = (over: Partial<TicketMessage>): TicketMessage => ({
  id: 'm', ticketId: 't', authorType: 'requester', authorId: 'r', authorName: 'Nadia Cruz',
  body: 'hi', channel: 'web', visibility: 'public', createdAt: '2026-07-15T01:00:00Z', ...over,
});

describe('ChatThread', () => {
  it('renders requester, agent, system, notes, attachments, and groups consecutive senders', async () => {
    const messages: TicketMessage[] = [
      msg({ id: 'm1', authorType: 'requester', body: 'Where is my parcel?', createdAt: '2026-07-15T01:00:00Z' }),
      msg({ id: 'm2', authorType: 'agent', authorName: 'Alex Cruz', body: 'Checking now.', createdAt: '2026-07-15T01:01:00Z' }),
      msg({ id: 'm3', authorType: 'agent', authorName: 'Alex Cruz', body: 'An update shortly.', createdAt: '2026-07-15T01:02:00Z' }),
      msg({ id: 'm4', authorType: 'system', authorName: 'HeyQ', body: 'Ticket received.', createdAt: '2026-07-15T01:03:00Z' }),
      msg({
        id: 'm5', authorType: 'requester', body: 'Here is a photo.', createdAt: '2026-07-15T01:04:00Z',
        attachments: [{ name: 'evidence.png', size: 2048, type: 'image/png' }],
      }),
    ];
    const notes: InternalNote[] = [
      { id: 'n1', ticketId: 't', agentId: 'l1_agent', agentName: 'Alex Cruz', body: 'Internal: escalating.', createdAt: '2026-07-15T01:05:00Z' },
    ];

    render(<ChatThread ticketId="t" messages={messages} notes={notes} pending={[]} requesterName="Nadia Cruz" />);

    expect(screen.getByText('Where is my parcel?')).toBeInTheDocument();
    expect(screen.getByText('Checking now.')).toBeInTheDocument();
    expect(screen.getByText('An update shortly.')).toBeInTheDocument();
    expect(screen.getByText('Ticket received.')).toBeInTheDocument();
    // Two consecutive agent messages share ONE header.
    expect(screen.getAllByText('Alex Cruz')).toHaveLength(2); // one message-group header + one note header
    // Attachment metadata renders beneath its message.
    expect(screen.getByText('evidence.png')).toBeInTheDocument();
    // Internal note stays clearly distinct.
    expect(screen.getByText('Internal note')).toBeInTheDocument();
    expect(screen.getByText('Internal: escalating.')).toBeInTheDocument();
  });

  it('shows optimistic sending and a retryable failed state', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const pending: PendingReply[] = [
      { tempId: 'p1', kind: 'reply', body: 'Sending this…', status: 'sending', createdAt: '2026-07-15T01:06:00Z' },
      { tempId: 'p2', kind: 'reply', body: 'This one failed', status: 'failed', createdAt: '2026-07-15T01:07:00Z' },
    ];
    render(<ChatThread ticketId="t" messages={[]} notes={[]} pending={pending} onRetry={onRetry} />);

    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.getByText(/failed to send/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledWith('p2');
  });
});
