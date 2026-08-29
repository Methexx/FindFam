'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * Which tab is currently selected.
 *
 * Radix marks the active trigger with `data-state="active"`, which is enough
 * for CSS but not for deciding whether to *render* the motion element — and
 * only one trigger may render it, or framer-motion has nothing to animate
 * between. Radix does not expose its value publicly, so this mirrors it.
 */
const TabsValueContext = React.createContext<string | undefined>(undefined);

/** One layoutId per list, so two lists on a page don't share a pill. */
const TabsLayoutIdContext = React.createContext('tabs-pill');

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
  // Controlled when `value` is supplied, uncontrolled otherwise — matching
  // Radix, so this wrapper does not quietly change how Tabs behaves.
  const current = value ?? uncontrolled;

  const handleValueChange = React.useCallback(
    (next: string) => {
      setUncontrolled(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );

  return (
    <TabsValueContext.Provider value={current}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsValueContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const layoutId = React.useId();

  return (
    <TabsLayoutIdContext.Provider value={layoutId}>
      <TabsPrimitive.List
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-glass-border bg-glass p-1 backdrop-blur-xl',
          className,
        )}
        {...props}
      />
    </TabsLayoutIdContext.Provider>
  );
});
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const layoutId = React.useContext(TabsLayoutIdContext);
  const currentValue = React.useContext(TabsValueContext);
  const prefersReducedMotion = useReducedMotion();
  const isActive = currentValue === props.value;

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-brand-soft',
        className,
      )}
      {...props}
    >
      {/* Decorative only — Radix keeps the roving-tabindex and aria-selected
          semantics on the trigger itself, so losing this loses nothing. */}
      {isActive ? (
        <motion.span
          layoutId={layoutId}
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-full bg-brand/15"
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
          }
        />
      ) : null}
      {children}
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
