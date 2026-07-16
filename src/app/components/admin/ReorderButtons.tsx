import { IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import type { MoveDirection } from '../../services/kbService';
import { cn } from '../../lib/utils';

export interface ReorderButtonsProps {
  label: string;
  onMove: (direction: MoveDirection) => void;
  disableUp?: boolean;
  disableDown?: boolean;
  disabled?: boolean;
}

/**
 * Up/down controls for manual ordering.
 *
 * Explicit buttons rather than drag-and-drop: they work from the keyboard and a
 * screen reader without a custom drag affordance, which matters because
 * reordering is the primary way admins arrange this content.
 */
export function ReorderButtons({ label, onMove, disableUp, disableDown, disabled }: ReorderButtonsProps) {
  return (
    <span className="inline-flex flex-col">
      <ReorderButton
        label={`Move ${label} up`}
        icon={IconChevronUp}
        onClick={() => onMove('up')}
        disabled={disabled || disableUp}
      />
      <ReorderButton
        label={`Move ${label} down`}
        icon={IconChevronDown}
        onClick={() => onMove('down')}
        disabled={disabled || disableDown}
      />
    </span>
  );
}

function ReorderButton({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: typeof IconChevronUp;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-5 w-6 items-center justify-center rounded text-muted-foreground transition-colors',
        'hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-30',
      )}
    >
      <Icon size={14} />
    </button>
  );
}
