'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Radio, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

/**
 * The server accepts one position per user every 4 seconds
 * (`MIN_UPDATE_INTERVAL_MS` in locations.service.ts) and 429s past that.
 * watchPosition can fire far more often than that indoors, so it is throttled
 * here rather than generating errors the user would see as a broken map.
 */
const MIN_SEND_INTERVAL_MS = 5_000;

type Permission = 'idle' | 'sharing' | 'denied' | 'unsupported' | 'error';

interface BatteryManager {
  level: number;
}

/**
 * Governs sharing from *this tab only*, and deliberately does not write
 * `users.is_sharing` via PATCH /locations/sharing-status.
 *
 * That flag is a single global per user, and it gates nothing server-side —
 * `submitLocation` never reads it, so it exists purely to drive the
 * persistent sharing indicator on the phone. Writing it from here would
 * therefore only ever mislead: switching it off when somebody closes a
 * browser tab would silently tell their phone it had stopped sharing when it
 * had not, and switching it on for a tab would leave the phone claiming to
 * share after the tab closed. Both are the same defect as a sign-out that
 * keeps sharing, pointed in different directions. The phone owns that flag.
 */
export function ShareLocationToggle({ send }: { send: (message: unknown) => boolean }) {
  const [state, setState] = useState<Permission>('idle');
  const watchIdRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);
  const batteryRef = useRef<number | null>(null);

  // Read once and keep the reference — getBattery() is a promise per call and
  // is unavailable on Firefox and Safari, where battery simply stays null.
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> };
    if (!nav.getBattery) return;
    void nav
      .getBattery()
      .then((battery) => {
        batteryRef.current = Math.round(battery.level * 100);
      })
      .catch(() => {
        batteryRef.current = null;
      });
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState('idle');
  }, []);

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setState('unsupported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setState('sharing');

        const now = Date.now();
        if (now - lastSentAtRef.current < MIN_SEND_INTERVAL_MS) return;
        lastSentAtRef.current = now;

        // The WebSocket is the ingest path; POST /locations is the REST
        // fallback. Both run through the same submitLocation, so a dropped
        // send just means one skipped fix, not a divergent code path.
        send({
          type: 'location:update',
          payload: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            speed: position.coords.speed,
            batteryLevel: batteryRef.current,
          },
        });
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'error');
        watchIdRef.current = null;
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
  }, [send]);

  // Closing the tab ends sharing whether we like it or not — clear the watch
  // so a client-side navigation does the same thing rather than leaving a
  // geolocation watcher running behind a page nobody is looking at.
  useEffect(
    () => () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    },
    [],
  );

  const isSharing = state === 'sharing';

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3',
          isSharing ? 'border-brand/30 bg-brand/10' : 'border-glass-border bg-glass',
        )}
      >
        <div className="flex items-center gap-2.5">
          {isSharing ? (
            <Radio className="h-4 w-4 shrink-0 text-brand" />
          ) : (
            <MapPinOff className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium">
              {isSharing ? 'Sharing your location' : 'Not sharing your location'}
            </p>
            {/* This wording is load-bearing. navigator.geolocation stops the
                moment the tab closes and there is no web equivalent of the
                Android foreground service — an indicator implying background
                coverage the browser does not have would be the same class of
                defect as a sign-out that keeps sharing. */}
            <p className="text-xs text-muted-foreground">
              {isSharing
                ? 'While this tab is open. Close it and sharing stops.'
                : 'The browser can only share while this tab is open.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant={isSharing ? 'outline' : 'gradient'}
          onClick={isSharing ? stop : start}
        >
          {isSharing ? 'Stop sharing' : 'Share my location'}
        </Button>
      </div>

      {state === 'denied' ? (
        <Alert variant="destructive">
          <AlertDescription>
            Your browser blocked location access. Allow it for this site in the address bar, then
            try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {state === 'unsupported' ? (
        <Alert variant="destructive">
          <AlertDescription>This browser cannot share location.</AlertDescription>
        </Alert>
      ) : null}

      {state === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>
            Could not get a location fix. This is common indoors — try again near a window, or use
            the phone app.
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
