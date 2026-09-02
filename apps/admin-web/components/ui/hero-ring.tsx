import { cn } from '@/lib/utils';

/**
 * A single luminous ring for the landing hero: a thin bright circle with a
 * soft halo bloom, lit from the top. Pure SVG (gradients + blur), no images,
 * themed off the existing --brand tokens.
 *
 * Sits in the hero's normal content flow, between the CTA buttons and the
 * trust-signal badges.
 *
 * Two details are load-bearing:
 *
 *  - The viewBox is square and `preserveAspectRatio` is left at its default
 *    (`xMidYMid meet`). The previous version of this component used
 *    `preserveAspectRatio="none"` against a 1000x160 viewBox, which stretched
 *    every shape non-uniformly and is exactly why the old arc looked
 *    distorted. A circle under `none` renders as a flattened ellipse, so it
 *    must not come back.
 *  - The halo is the same circle drawn twice — once thick and heavily
 *    blurred, once thin and crisp on top — rather than a filled background
 *    shape. Nothing here paints a rectangle, so there are no straight edges
 *    to catch the eye.
 */
export function HeroRing({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex h-28 w-full items-center justify-center sm:h-36', className)}
    >
      <svg viewBox="0 0 200 200" className="h-full w-auto">
        <defs>
          {/* Lit from above: bright at the top of the ring, falling away
              toward the bottom, so it reads as catching light rather than
              being uniformly coloured. */}
          <linearGradient id="hero-ring-stroke" gradientUnits="userSpaceOnUse" x1="100" y1="20" x2="100" y2="180">
            <stop offset="0%" stopColor="hsl(255 100% 98%)" stopOpacity="0.95" />
            <stop offset="35%" stopColor="hsl(var(--brand-soft))" stopOpacity="0.7" />
            <stop offset="75%" stopColor="hsl(var(--brand))" stopOpacity="0.35" />
            <stop offset="100%" stopColor="hsl(var(--brand-strong))" stopOpacity="0.15" />
          </linearGradient>
          <filter id="hero-ring-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        {/* Soft halo under the crisp ring, same circle, heavily blurred */}
        <circle
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke="url(#hero-ring-stroke)"
          strokeWidth="10"
          filter="url(#hero-ring-blur)"
        />
        {/* Crisp bright ring on top */}
        <circle
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke="url(#hero-ring-stroke)"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
}
