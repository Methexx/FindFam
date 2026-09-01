'use client';

import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import type { LocationUpdate } from '@findfam/shared-types';
import 'leaflet/dist/leaflet.css';
import {
  MAP_TILE_URL,
  MAP_TILE_ATTRIBUTION,
  isStale,
  timeAgo,
  displayNameFor,
} from '@/lib/map-config';

/**
 * Mirrors `member_marker.dart`: an avatar ring centred exactly on the
 * coordinate, not a teardrop pin. At circle-sized member counts a centred
 * disc reads more clearly and avoids fighting anchor maths for a shape that
 * does not need it.
 *
 * Built as a divIcon rather than an image so the ring colour and the stale
 * treatment come from the same tokens as the rest of the page.
 */
const MARKER_SIZE = 44;

/**
 * Which device reported this fix, not who reported it — self vs. others is
 * carried separately by the ring colour. Falls back to the generic person
 * glyph for a `null` platform (a row recorded before this field existed, or
 * a client build that hasn't been updated to send it yet).
 */
function platformGlyph(platform: 'web' | 'mobile' | null): string {
  if (platform === 'web') {
    // Laptop.
    return '<rect x="3" y="4" width="18" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M2 20h20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  }
  if (platform === 'mobile') {
    // Phone.
    return '<rect x="7" y="2" width="10" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="11" y1="18" x2="13" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  }
  return '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/>';
}

function markerIcon(stale: boolean, self: boolean, platform: 'web' | 'mobile' | null): L.DivIcon {
  const ring = self ? 'hsl(var(--brand))' : '#0ea5e9';
  const glyph = platformGlyph(platform);

  // The halo is on live markers ONLY, and that is the whole point of it: the
  // map's job is to answer "is this where they are *now*", so the thing that
  // moves is the thing that is current. A stale pin sits still, faded and
  // badged — rendering it at full strength would present a possibly
  // hours-old fix as somebody's present location, which is the specific way
  // this kind of map misleads. Purely visual; the badge and the popup's
  // "Last seen" carry the same fact in text.
  const liveHalo = stale
    ? ''
    : `<span style="position:absolute;inset:0;border-radius:9999px;border:2px solid ${ring};" class="animate-pulse-ring"></span>`;

  const staleBadge = stale
    ? `<span style="position:absolute;right:-2px;bottom:-2px;width:16px;height:16px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;">
         <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round">
           <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
         </svg>
       </span>`
    : '';

  return L.divIcon({
    className: 'findfam-marker',
    iconSize: [MARKER_SIZE, MARKER_SIZE],
    iconAnchor: [MARKER_SIZE / 2, MARKER_SIZE / 2],
    popupAnchor: [0, -MARKER_SIZE / 2],
    html: `
      <div style="position:relative;width:${MARKER_SIZE}px;height:${MARKER_SIZE}px;opacity:${stale ? 0.55 : 1};">
        ${liveHalo}
        <div style="position:relative;width:100%;height:100%;border-radius:9999px;background:#fff;border:3px solid ${ring};
                    box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:${ring};">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor">${glyph}</svg>
        </div>
        ${staleBadge}
      </div>
    `,
  });
}

/**
 * Fits the viewport to every member once per circle, the way mobile's
 * `CameraFit.coordinates` does — it used to centre on an arbitrary member.
 *
 * Deliberately keyed on the circle, not on the positions: refitting on every
 * broadcast would yank the map out from under somebody who had panned away
 * to look at something.
 */
function fitToLocations(map: L.Map, locations: LocationUpdate[]): void {
  const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng] as [number, number]));
  if (locations.length === 1) {
    map.setView(bounds.getCenter(), 15);
  } else {
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
  }
}

function FitToMembers({
  locations,
  circleId,
  selfUserId,
}: {
  locations: LocationUpdate[];
  circleId: string | null;
  selfUserId: string | null;
}) {
  const map = useMap();
  const hasSelfFix = (locs: LocationUpdate[]) => locs.some((l) => l.userId === selfUserId);
  // Tracks "has *my own* marker been fit yet" rather than "did any location
  // exist at mount" — an existing circle with other members' positions, or a
  // previously-recorded self-location, must not permanently disable this:
  // sharing your own location for the first time should still re-fit the
  // view even when other markers were already on screen.
  const hadSelfFixRef = useRef(hasSelfFix(locations));

  useEffect(() => {
    if (locations.length === 0) return;
    fitToLocations(map, locations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, map]);

  useEffect(() => {
    const currentlyHasSelf = hasSelfFix(locations);
    if (hadSelfFixRef.current || !currentlyHasSelf) return;
    hadSelfFixRef.current = true;
    fitToLocations(map, locations);
  }, [locations, map, selfUserId]);

  return null;
}

export interface CircleMapProps {
  circleId: string | null;
  locations: LocationUpdate[];
  selfUserId: string | null;
}

export default function CircleMap({ circleId, locations, selfUserId }: CircleMapProps) {
  const center = useMemo<[number, number]>(() => {
    const first = locations[0];
    return first ? [first.lat, first.lng] : [20, 0];
  }, [locations]);

  return (
    <MapContainer
      center={center}
      zoom={locations.length > 0 ? 13 : 2}
      scrollWheelZoom
      className="h-full w-full rounded-lg"
    >
      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} />
      <FitToMembers locations={locations} circleId={circleId} selfUserId={selfUserId} />

      {locations.map((location) => {
        const stale = isStale(location.recordedAt);
        const self = location.userId === selfUserId;
        const name = self ? 'You' : displayNameFor(location.userId, location.username);

        return (
          <Marker
            key={location.userId}
            position={[location.lat, location.lng]}
            icon={markerIcon(stale, self, location.platform)}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-medium">{name}</p>
                <p className={stale ? 'font-semibold text-amber-600' : 'text-slate-500'}>
                  {stale ? 'Last seen ' : 'Updated '}
                  {timeAgo(location.recordedAt)}
                </p>
                <p className="text-slate-500">
                  {location.speed !== null ? `${Math.round(location.speed * 3.6)} km/h` : 'Speed unknown'}
                  {' · '}
                  {location.batteryLevel !== null ? `${location.batteryLevel}% battery` : 'Battery unknown'}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
