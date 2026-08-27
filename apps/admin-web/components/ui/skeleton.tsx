import { cn } from '@/lib/utils';

/**
 * A sweep rather than a pulse. A whole-block opacity fade reads as "this
 * element is disabled"; a highlight travelling left-to-right reads as
 * "something is arriving", which is what a skeleton is for.
 *
 * The sweep is a child with `translate-x-[-100%]` under `overflow-hidden`,
 * not a background-position animation, so it composites on the GPU instead of
 * repainting the element every frame.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('relative overflow-hidden rounded-md bg-muted', className)} {...props}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export { Skeleton };
