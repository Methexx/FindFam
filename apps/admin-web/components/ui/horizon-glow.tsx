import { cn } from '@/lib/utils';

/**
 * A compact light-horizon divider: a thin bright arc with a soft glow above
 * it, fading to nothing at both its left and right ends. Pure SVG (gradients
 * + blur), no images, themed off the existing --brand tokens.
 *
 * Sits in the hero's normal content flow (between the CTA buttons and the
 * trust-signal badges), sized to its own box rather than breaking out to
 * full viewport width — so it just needs to span whatever container it's
 * placed in.
 *
 * The fade-to-transparent at the edges is done with an explicit <mask> in
 * fixed userSpace coordinates (0 to 1000, matching the viewBox exactly),
 * not a per-shape gradient bounding box — so both the glow and the line
 * taper to fully transparent at the same x=0/x=1000 edges deterministically,
 * regardless of each shape's own bounding box.
 */
export function HorizonGlow({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('relative h-28 w-full overflow-hidden sm:h-36', className)}>
      <svg viewBox="0 0 1000 160" preserveAspectRatio="none" className="h-full w-full">
        <defs>
          <radialGradient id="horizon-fan" cx="50%" cy="15%" r="35%">
            <stop offset="0%" stopColor="hsl(var(--brand-soft))" stopOpacity="0.5" />
            <stop offset="30%" stopColor="hsl(var(--brand))" stopOpacity="0.25" />
            <stop offset="65%" stopColor="hsl(var(--brand-strong))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="hsl(var(--brand-strong))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="horizon-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
            <stop offset="50%" stopColor="hsl(255 100% 98%)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
          </linearGradient>
          <linearGradient id="horizon-fade-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="18%" stopColor="#fff" stopOpacity="1" />
            <stop offset="82%" stopColor="#fff" stopOpacity="1" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="horizon-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="160">
            <rect x="0" y="0" width="1000" height="160" fill="url(#horizon-fade-gradient)" />
          </mask>
          <filter id="horizon-blur" x="-20%" y="-300%" width="140%" height="700%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <g mask="url(#horizon-fade)">
          <rect width="1000" height="160" fill="url(#horizon-fan)" />

          {/* Soft halo under the crisp line, same curve, heavily blurred */}
          <path
            d="M 0 130 Q 500 30 1000 130"
            stroke="url(#horizon-line)"
            strokeWidth="14"
            fill="none"
            filter="url(#horizon-blur)"
          />
          {/* Crisp bright line on top */}
          <path d="M 0 130 Q 500 30 1000 130" stroke="url(#horizon-line)" strokeWidth="1.5" fill="none" />
        </g>
      </svg>
    </div>
  );
}
