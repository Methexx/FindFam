import { cn } from '@/lib/utils';

/**
 * A plain <img>, not next/image — avatarUrl is an external Supabase Storage
 * URL, and next/image's optimizer would need that host allowlisted in
 * next.config.js for no benefit here (these are already-sized, already-
 * compressed uploads, not arbitrary large source images).
 */
export function Avatar({
  url,
  name,
  size = 64,
  className,
}: {
  url: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-glass-border bg-glass text-muted-foreground',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="font-medium">{initial}</span>
      )}
    </div>
  );
}
