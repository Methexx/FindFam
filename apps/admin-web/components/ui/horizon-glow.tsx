import { cn } from '@/lib/utils';

/**
 * The curved light-horizon effect from the reference moodboard: a thin bright
 * arc with a soft fan of glow rising above it, dimming to nothing at the top.
 * Pure SVG (gradients + blur), no images, so it stays crisp at any size and
 * themes off the existing --brand tokens rather than a hardcoded color.
 *
 * Lives at the very top of the page, behind the (glass, blurred) sticky nav,
 * not inside the hero section — so the curve sits in the nav's glass band
 * the way it does in the reference, and the glow has room to fully fade to
 * black before it ever reaches the headline below. The radial gradient's
 * hot center is placed AT the curve itself (not at the bottom of the SVG's
 * bounding box) with a short radius, so brightness stays concentrated near
 * the line instead of washing out into a flat rectangle of color.
 */
export function HorizonGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 -z-10 h-[260px] overflow-hidden sm:h-[340px]',
        className,
      )}
    >
      <svg
        viewBox="0 0 1000 340"
        preserveAspectRatio="xMidYMin slice"
        className="absolute left-1/2 top-0 h-full w-[130%] -translate-x-1/2"
      >
        <defs>
          <radialGradient id="horizon-fan" cx="50%" cy="18%" r="30%">
            <stop offset="0%" stopColor="hsl(var(--brand-soft))" stopOpacity="0.55" />
            <stop offset="30%" stopColor="hsl(var(--brand))" stopOpacity="0.28" />
            <stop offset="65%" stopColor="hsl(var(--brand-strong))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(var(--brand-strong))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizon-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(255 100% 98%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </linearGradient>
          <filter id="horizon-blur" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <rect width="1000" height="340" fill="url(#horizon-fan)" />

        {/* Soft halo under the crisp line, same curve, heavily blurred */}
        <path
          d="M -50 90 Q 500 8 1050 90"
          stroke="url(#horizon-line)"
          strokeWidth="14"
          fill="none"
          filter="url(#horizon-blur)"
        />
        {/* Crisp bright line on top */}
        <path d="M -50 90 Q 500 8 1050 90" stroke="url(#horizon-line)" strokeWidth="1.5" fill="none" />
      </svg>
    </div>
  );
}
