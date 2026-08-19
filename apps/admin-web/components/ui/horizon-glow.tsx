import { cn } from '@/lib/utils';

/**
 * The curved light-horizon effect from the reference moodboard: a thin bright
 * arc with a soft fan of glow rising above it, dimming to nothing at the top.
 * Pure SVG (gradients + blur), no images, so it stays crisp at any size and
 * themes off the existing --brand tokens rather than a hardcoded color.
 *
 * Pinned to a fixed-height band at the top of its container (not stretched
 * across the whole hero) so the curve's brightest point sits near the nav,
 * above the headline, the way it does in the reference — not buried behind
 * body text at the section's vertical midpoint.
 */
export function HorizonGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden sm:h-[520px]',
        className,
      )}
    >
      <svg
        viewBox="0 0 1000 420"
        preserveAspectRatio="xMidYMax slice"
        className="absolute left-1/2 top-0 h-full w-[130%] -translate-x-1/2"
      >
        <defs>
          <radialGradient id="horizon-fan" cx="50%" cy="100%" r="80%">
            <stop offset="0%" stopColor="hsl(var(--brand-soft))" stopOpacity="0.85" />
            <stop offset="30%" stopColor="hsl(var(--brand))" stopOpacity="0.55" />
            <stop offset="60%" stopColor="hsl(var(--brand-strong))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--brand-strong))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizon-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(255 100% 98%)" stopOpacity="1" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </linearGradient>
          <filter id="horizon-blur" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
        </defs>

        <rect width="1000" height="420" fill="url(#horizon-fan)" />

        {/* Soft halo under the crisp line, same curve, heavily blurred */}
        <path
          d="M -50 380 Q 500 60 1050 380"
          stroke="url(#horizon-line)"
          strokeWidth="18"
          fill="none"
          filter="url(#horizon-blur)"
        />
        {/* Crisp bright line on top */}
        <path d="M -50 380 Q 500 60 1050 380" stroke="url(#horizon-line)" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}
