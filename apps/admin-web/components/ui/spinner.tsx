import { cn } from '@/lib/utils';

/**
 * `aria-hidden` by default: a spinner beside text that already says
 * "Creating…" is decoration, and announcing it twice is worse than not
 * announcing it. Callers that need a standalone busy indicator pass their own
 * label and set `aria-hidden={false}`.
 */
export function Spinner({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className={cn('h-4 w-4 animate-spin', className)}
      {...props}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
