import { cn } from '@/lib/utils';

export function GlowBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div
        className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, hsl(var(--brand) / 0.35), transparent)' }}
      />
      <div
        className="absolute right-0 top-20 h-72 w-72 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(closest-side, hsl(var(--brand-strong) / 0.3), transparent)' }}
      />
    </div>
  );
}
