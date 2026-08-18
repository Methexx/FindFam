import { MapPin } from 'lucide-react';
import { CAST } from '@/lib/landing-content';

const PINS = [
  { username: CAST.maya, top: '30%', left: '35%' },
  { username: CAST.rob, top: '58%', left: '64%' },
];

export function LiveMapMockup() {
  return (
    <div className="w-full max-w-sm rounded-lg border border-glass-border bg-glass shadow-lg shadow-black/20 backdrop-blur-xl">
      <div className="flex items-center gap-1.5 border-b border-glass-border px-3 py-2.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        <span className="ml-2 text-xs text-muted-foreground">{CAST.circle}</span>
      </div>

      <div
        className="relative h-56 w-full"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {PINS.map((pin) => (
          <div
            key={pin.username}
            className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ top: pin.top, left: pin.left }}
          >
            <span className="mb-1 whitespace-nowrap rounded-full border border-glass-border bg-glass px-2 py-0.5 text-[11px] text-foreground backdrop-blur">
              {pin.username}
            </span>
            <MapPin className="h-5 w-5 text-brand" fill="hsl(var(--brand) / 0.25)" />
          </div>
        ))}
      </div>

      <p className="border-t border-glass-border px-3 py-2 text-[11px] text-muted-foreground">
        Illustrative preview — not live data
      </p>
    </div>
  );
}
