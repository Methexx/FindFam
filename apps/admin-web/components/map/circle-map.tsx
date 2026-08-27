'use client';

import { useEffect, useMemo } from 'react';
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

function markerIcon(stale: boolean, self: boolean): L.DivIcon {
  const ring = self ? 'hsl(var(--brand))' : '#0ea5e9';
  const glyph = self
    ? '<circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'
    : '<circle cx="12" cy="8" r="4" fill="currentColor"/><path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor"/>';

  // A stale position is faded and badged with a clock. Rendering it at full
  // strength would present a possibly hours-old fix as somebody's current
  // location, which is the specific way this kind of map misleads.
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
        <div style="width:100%;height:100%;border-radius:9999px;background:#fff;border:3px solid ${ring};
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
function FitToMembers({ locations, circleId }: { locations: LocationUpdate[]; circleId: string }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) return;

    const bounds = L.latLngBounds(locations.map((l) => [l.lat, l.lng] as [number, number]));
    if (locations.length === 1) {
      map.setView(bounds.getCenter(), 15);
    } else {
      map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, map]);

  return null;
}

export interface CircleMapProps {
  circleId: string;
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
      <FitToMembers locations={locations} circleId={circleId} />

      {locations.map((location) => {
        const stale = isStale(location.recordedAt);
        const self = location.userId === selfUserId;
        const name = self ? 'You' : displayNameFor(location.userId, location.username);

        return (
          <Marker
            key={location.userId}
            position={[location.lat, location.lng]}
            icon={markerIcon(stale, self)}
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
