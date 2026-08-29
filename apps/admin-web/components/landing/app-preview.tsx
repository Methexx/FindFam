import { Radio, Wifi } from 'lucide-react';

/**
 * A static, non-interactive picture of `/app/map`, sat directly under the
 * hero — the one structural move that makes bridle.io's front page read the
 * way it does: say what the thing is, then immediately show it.
 *
 * Pure SVG and CSS. No Leaflet, no tiles, no data, no `'use client'` — this
 * is a picture of the product, not the product, and it must not pull a map
 * library into the landing page's bundle to say so. The streets are
 * invented; nothing here claims to be a real place or a real person.
 *
 * Note for anyone reading the history: commit 9fcee04 removed a map mockup
 * from this page. That one was a decorative panel floating inside the hero
 * that fought the horizon glow. This is a different thing in a different
 * place — a framed product shot in its own section below the hero, with the
 * glow left where e09fd11 put it.
 */

const MEMBERS = [
  { name: 'Amara', detail: 'Updated just now', x: '32%', y: '38%', self: false, stale: false },
  { name: 'You', detail: 'Updated just now', x: '58%', y: '58%', self: true, stale: false },
  { name: 'Ravi', detail: 'Last seen 22m ago', x: '73%', y: '28%', self: false, stale: true },
];

export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-glass-border bg-glass shadow-2xl shadow-black/40 backdrop-blur-xl">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-glass-border px-4 py-2.5">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 text-center">
          <span className="rounded-full border border-glass-border px-3 py-0.5 text-[11px] text-muted-foreground">
            findfam.app/app/map
          </span>
        </div>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Wifi className="h-3 w-3 text-emerald-400" />
          Live
        </span>
      </div>

      <div className="grid gap-px bg-glass-border sm:grid-cols-[1fr_13rem]">
        {/* Map plate */}
        <div className="relative h-64 bg-[#0b0a18] sm:h-80">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 400 300"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="preview-glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.16" />
                <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect width="400" height="300" fill="#0b0a18" />
            <rect width="400" height="300" fill="url(#preview-glow)" />

            {/* Invented street grid — suggestion of a map, not a claim to be one */}
            <g stroke="rgba(255,255,255,0.07)" strokeWidth="1">
              <path d="M-20 70 H420 M-20 150 H420 M-20 232 H420" />
              <path d="M62 -20 V320 M168 -20 V320 M262 -20 V320 M340 -20 V320" />
            </g>
            <g stroke="rgba(255,255,255,0.11)" strokeWidth="3" strokeLinecap="round" fill="none">
              <path d="M-20 190 C 80 190, 120 120, 220 118 S 360 60, 420 44" />
              <path d="M118 320 C 126 220, 190 190, 210 100 S 250 20, 258 -20" />
            </g>
            <g fill="rgba(255,255,255,0.035)">
              <rect x="76" y="86" width="72" height="48" rx="4" />
              <rect x="286" y="166" width="86" height="56" rx="4" />
              <rect x="20" y="238" width="60" height="40" rx="4" />
            </g>
          </svg>

          {MEMBERS.map((member) => (
            <PreviewPin key={member.name} {...member} />
          ))}

          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/15 px-2.5 py-1 text-[11px] font-medium text-brand-soft backdrop-blur">
            <Radio className="h-3 w-3" />
            Sharing — while this tab is open
          </div>
        </div>

        {/* Member list */}
        <div className="bg-background/40 p-3">
          <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            3 positions
          </p>
          <ul className="space-y-0.5">
            {MEMBERS.map((member) => (
              <li key={member.name} className="rounded-md px-1 py-1.5">
                <p
                  className={
                    member.stale ? 'text-sm font-medium text-muted-foreground' : 'text-sm font-medium'
                  }
                >
                  {member.name}
                </p>
                <p
                  className={
                    member.stale ? 'text-[11px] font-medium text-amber-400' : 'text-[11px] text-muted-foreground'
                  }
                >
                  {member.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PreviewPin({
  name,
  x,
  y,
  self,
  stale,
}: {
  name: string;
  x: string;
  y: string;
  self: boolean;
  stale: boolean;
}) {
  const ring = self ? 'hsl(var(--brand))' : '#0ea5e9';

  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: x, top: y, opacity: stale ? 0.55 : 1 }}
    >
      {/* Live pins pulse, the stale one does not — the same rule the real
          map follows, so this picture demonstrates the behaviour rather than
          just illustrating a map. */}
      {stale ? null : (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-pulse-ring rounded-full border-2"
          style={{ borderColor: ring }}
        />
      )}
      <div
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-semibold shadow-lg shadow-black/40"
        style={{ border: `3px solid ${ring}`, color: ring }}
      >
        {name.slice(0, 2)}
      </div>
      {stale ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>
      ) : null}
    </div>
  );
}
