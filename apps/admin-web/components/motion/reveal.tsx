'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

// Scroll-reveal wrapper for landing/architecture content. Both pages stay
// server components (they read cookies() for session detection), so this is
// the one client leaf they mount rather than converting wholesale.
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
