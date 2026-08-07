'use client';

import type { AdminSosEvent } from '@findfam/shared-types';
import { useAdminSosFeed } from '../../../lib/admin-ws-client';

export default function SosLiveFeed({ initialEvents }: { initialEvents: AdminSosEvent[] }) {
  const { events, connectionStatus } = useAdminSosFeed(initialEvents);
  const activeEvents = events.filter((event) => event.status === 'active');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Active SOS Events</h1>
        <span
          className={`text-xs px-2 py-1 rounded ${
            connectionStatus === 'open'
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {connectionStatus === 'open' ? 'Live' : connectionStatus}
        </span>
      </div>

      {activeEvents.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active SOS events.</p>
      ) : (
        <div className="space-y-3">
          {activeEvents.map((event) => (
            <div
              key={event.id}
              className="border-2 border-red-500 bg-red-50 rounded-lg p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-semibold text-red-900">{event.username}</p>
                <p className="text-sm text-red-800">
                  {event.origin.lat.toFixed(5)}, {event.origin.lng.toFixed(5)}
                </p>
                <p className="text-xs text-red-700">
                  Triggered {new Date(event.triggeredAt).toLocaleTimeString()}
                </p>
              </div>
              <span className="text-xs font-bold uppercase text-red-600">Active</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
