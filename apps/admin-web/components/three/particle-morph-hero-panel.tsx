'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const ParticleMorph = dynamic(() => import('./particle-morph').then((m) => m.ParticleMorph), {
  ssr: false,
});

/**
 * Hero-right-column wrapper around the generic ParticleMorph scene: just
 * sizes it into a bounded box, no visible chrome around the particles
 * themselves (no background panel, no border). Click the shape to morph —
 * see particle-morph.tsx's canvas click handler.
 * Three.js itself is only pulled in client-side via next/dynamic so
 * page.tsx (a Server Component) never touches that module graph.
 */
export function ParticleMorphHeroPanel({ className }: { className?: string }) {
  return (
    <div className={cn('aspect-square w-full max-w-xs', className)}>
      <ParticleMorph />
    </div>
  );
}
