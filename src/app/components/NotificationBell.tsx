import { useCallback } from 'react';
import { Link } from 'react-router';
import { IconBell } from '@tabler/icons-react';
import { unreadCount } from '../services/notificationService';
import { useQuery } from '../hooks/useQuery';
import { useIdentity } from '../contexts/IdentityContext';

/** Header bell with an unread badge, linking to the notifications feed. */
export function NotificationBell() {
  const { identity } = useIdentity();
  const count = useQuery(useCallback(() => unreadCount(identity.id), [identity.id]), [identity.id]);
  const unread = count.data ?? 0;

  return (
    <Link
      to="/app/notifications"
      aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-accent"
    >
      <IconBell size={20} />
      {unread > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {unread}
        </span>
      )}
    </Link>
  );
}
