import { cn } from '@/lib/utils';

/**
 * The curved light-horizon effect from the reference moodboard: a thin bright
 * arc with a soft fan of glow rising above it, dimming to nothing at the top.
 * Pure SVG (gradients + blur), no images, so it stays crisp at any size and
 * themes off the existing --brand tokens rather than a hardcoded color.
 */
export function HorizonGlow({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <svg
        viewBox="0 0 1000 380"
        preserveAspectRatio="xMidYMax slice"
        className="absolute left-1/2 top-0 h-full w-[130%] -translate-x-1/2"
      >
        <defs>
          <radialGradient id="horizon-fan" cx="50%" cy="100%" r="75%">
            <stop offset="0%" stopColor="hsl(var(--brand-soft))" stopOpacity="0.5" />
            <stop offset="35%" stopColor="hsl(var(--brand))" stopOpacity="0.28" />
            <stop offset="70%" stopColor="hsl(var(--brand-strong))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="hsl(var(--brand-strong))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizon-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(255 100% 97%)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </linearGradient>
          <filter id="horizon-blur" x="-20%" y="-200%" width="140%" height="500%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width="1000" height="380" fill="url(#horizon-fan)" />

        {/* Soft halo under the crisp line, same curve, heavily blurred */}
        <path
          d="M -50 300 Q 500 130 1050 300"
          stroke="url(#horizon-line)"
          strokeWidth="10"
          fill="none"
          filter="url(#horizon-blur)"
        />
        {/* Crisp bright line on top */}
        <path d="M -50 300 Q 500 130 1050 300" stroke="url(#horizon-line)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
