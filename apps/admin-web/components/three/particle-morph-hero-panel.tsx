'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ParticleMorph = dynamic(() => import('./particle-morph').then((m) => m.ParticleMorph), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-xl bg-brand/5" />,
});

/**
 * Hero-right-column wrapper around the generic ParticleMorph scene: sizes it
 * into a bounded box and adds the "Change shape" button, wired to the same
 * nextShape() path the canvas click uses (see particle-morph.tsx's onReady).
 * Three.js itself is only pulled in client-side via next/dynamic so
 * page.tsx (a Server Component) never touches that module graph.
 */
export function ParticleMorphHeroPanel({ className }: { className?: string }) {
  const nextShapeRef = useRef<(() => void) | null>(null);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="aspect-square w-full max-w-md overflow-hidden rounded-xl">
        <ParticleMorph
          onReady={(controls) => {
            nextShapeRef.current = controls.nextShape;
          }}
        />
      </div>
      <button
        type="button"
        className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        onClick={() => nextShapeRef.current?.()}
      >
        Change shape
      </button>
    </div>
  );
}
