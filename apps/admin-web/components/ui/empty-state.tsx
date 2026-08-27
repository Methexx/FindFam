import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * The "there is nothing here yet" block, which was hand-written four times
 * with drifting markup before this.
 *
 * Empty states here read as an instruction, not as a query result: "You are
 * not in a circle yet" and what to do about it, rather than "No circles
 * found." A first-run screen is the most common way somebody sees these, and
 * a result-shaped message on a brand new account reads like a failure.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card variant="glass" className={className}>
      <CardContent className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium">{title}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

/** The same message without the card, for use inside one. */
export function InlineEmptyState({
  icon: Icon,
  body,
  className,
}: {
  icon: LucideIcon;
  body: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 py-8 text-center', className)}>
      <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
