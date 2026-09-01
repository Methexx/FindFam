/**
 * CARTO's Voyager tiles (what this used to point at, and what
 * `apps/mobile/lib/core/map/map_tile_config.dart` still uses) now bake an
 * "API key required" watermark into every tile — a policy change on CARTO's
 * side, confirmed by fetching a tile directly, not a wiring bug here. Esri's
 * World Street Map tile service needs no signup and no key.
 *
 * Note the placeholder order: Esri's REST tile scheme is `{z}/{y}/{x}` (row
 * before column), unlike CARTO/OSM's `{z}/{x}/{y}` — that is intentional,
 * not a typo.
 */
export const MAP_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

export const MAP_TILE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012';

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
