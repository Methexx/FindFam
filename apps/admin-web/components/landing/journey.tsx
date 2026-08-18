import { Badge } from '@/components/ui/badge';
import type { Journey } from '@/lib/landing-content';

// Renders one end-to-end journey as a numbered vertical trace. The connecting
// rail is what makes it read as a single path rather than a bulleted list —
// each step hands off to the next.

export function JourneyTrace({ journey }: { journey: Journey }) {
  return (
    <section aria-labelledby={`journey-${journey.id}`}>
      <div className="mb-6 max-w-2xl">
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {journey.eyebrow}
        </p>
        <h3 id={`journey-${journey.id}`} className="text-xl font-semibold tracking-tight">
          {journey.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{journey.summary}</p>
      </div>

      <ol className="space-y-0">
        {journey.steps.map((step, index) => {
          const isLast = index === journey.steps.length - 1;

          return (
            <li key={step.title} className="relative flex gap-4">
              {/* Rail + step number */}
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-glass-border bg-glass text-xs font-medium tabular-nums backdrop-blur">
                  {index + 1}
                </span>
                {!isLast ? (
                  <span
                    className="w-px flex-1 bg-gradient-to-b from-brand/50 to-transparent"
                    aria-hidden="true"
                  />
                ) : null}
              </div>

              <div className={isLast ? 'pb-0' : 'pb-7'}>
                <div className="rounded-md border border-glass-border bg-glass p-4 backdrop-blur">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {step.actor}
                    </Badge>
                    <h4 className="text-sm font-medium">{step.title}</h4>
                    {step.status ? (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        {step.status}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {step.detail}
                  </p>
                </div>

                {step.example ? (
                  <figure className="mt-3 overflow-hidden rounded-md border border-border bg-muted/40">
                    <figcaption className="border-b border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                      {step.example.label}
                    </figcaption>
                    {/* Wide payloads scroll inside the block, never the page */}
                    <div className="overflow-x-auto">
                      <pre className="px-3 py-2.5 font-mono text-xs leading-relaxed">
                        <code>{step.example.code}</code>
                      </pre>
                    </div>
                  </figure>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
