/**
 * The same basemap the Flutter app uses — see
 * `apps/mobile/lib/core/map/map_tile_config.dart`, which these values are
 * copied from deliberately. Two clients on different tile sources look like
 * two products; on the same source they look like one.
 *
 * CARTO's Voyager tiles are on a fast CDN and need no API key, unlike OSM's
 * bare tile.openstreetmap.org, which is not meant for production traffic and
 * was the cause of slow map loads on mobile before the switch.
 */
export const MAP_TILE_URL =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

export const MAP_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * A position older than this is rendered as stale — faded, with a clock
 * badge — rather than as a live one. Matches `MemberLocation.isStale` in
 * `apps/mobile/lib/features/.../member_location.dart`; the two must agree,
 * because a stale pin drawn as a live one is the specific way a location map
 * lies to the person reading it.
 */
export const STALE_AFTER_MS = 5 * 60 * 1000;

export function isStale(recordedAt: string): boolean {
  return Date.now() - new Date(recordedAt).getTime() > STALE_AFTER_MS;
}

/** "4m ago" / "2h ago" — the web counterpart of mobile's `timeAgo`. */
export function timeAgo(recordedAt: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(recordedAt).getTime()) / 1000));
  if (seconds < 60) return 'just now';

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

/**
 * Prefers the username the backend now sends, and falls back to a short,
 * honest label rather than splashing a 36-character UUID across the UI —
 * the same rule as `MemberLocation.displayName` on mobile.
 */
export function displayNameFor(userId: string, username: string | null | undefined): string {
  return username ?? `Member ${userId.slice(0, 4)}`;
}
