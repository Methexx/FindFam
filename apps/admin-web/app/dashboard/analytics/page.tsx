import { Users, Radio, TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { adminApiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface AnalyticsSummary {
  totalUsers: number;
  activeCircles: number;
  totalSosEvents: number;
  sosEventsPerDay: { day: string; count: number }[];
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card variant="glass">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SosBarChart({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(...data.map((row) => row.count), 1);
  const peakIndex = data.reduce(
    (best, row, i) => (row.count > (data[best]?.count ?? -Infinity) ? i : best),
    0,
  );

  return (
    <div className="flex h-48 items-end gap-2 px-2 pt-8">
      {data.map((row, i) => {
        const heightPct = row.count === 0 ? 4 : Math.max((row.count / max) * 100, 10);
        const isPeak = i === peakIndex && row.count > 0;
        return (
          <div key={row.day} className="group flex flex-1 flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end justify-center">
              <span
                className={cn(
                  'pointer-events-none absolute -top-6 whitespace-nowrap text-xs font-medium transition-opacity',
                  isPeak
                    ? 'text-brand-soft opacity-100'
                    : 'text-muted-foreground opacity-0 group-hover:opacity-100',
                )}
              >
                {row.count}
              </span>
              <div
                className={cn(
                  'w-full max-w-8 rounded-t-md bg-gradient-to-t from-brand-strong to-brand transition-[filter] group-hover:brightness-110',
                  isPeak && 'shadow-glow',
                )}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {new Date(row.day).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default async function AnalyticsPage() {
  const result = await adminApiGet<AnalyticsSummary>('/api/v1/admin/analytics/summary');

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <Card variant="glass">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {result.reason === 'unauthenticated'
              ? 'Your session has expired. Please log in again.'
              : result.message ?? 'Unable to load analytics — the backend request failed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = result.data;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile label="Total Users" value={summary.totalUsers} icon={Users} />
        <StatTile label="Active Circles" value={summary.activeCircles} icon={Radio} />
        <StatTile label="Total SOS Events" value={summary.totalSosEvents} icon={TriangleAlert} />
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">SOS Events (last 14 days)</h2>
        {summary.sosEventsPerDay.length === 0 ? (
          <Card variant="glass">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No SOS events in this window.
            </CardContent>
          </Card>
        ) : (
          <Card variant="glass">
            <CardContent className="p-6">
              <SosBarChart data={summary.sosEventsPerDay} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
