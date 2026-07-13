import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface FormFieldProps {
  label: ReactNode;
  htmlFor?: string;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
  /** Render-prop receiving the generated id so the control can be labelled. */
  children: (id: string) => ReactNode;
}

/** Label + control + optional hint/error, wired for accessible labelling. */
export function FormField({ label, error, hint, className, children }: FormFieldProps) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
