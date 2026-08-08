import { cookies } from 'next/headers';

interface AnalyticsSummary {
  totalUsers: number;
  activeCircles: number;
  totalSosEvents: number;
  sosEventsPerDay: { day: string; count: number }[];
}

async function fetchSummary(): Promise<AnalyticsSummary | null> {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return null;
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiBaseUrl}/api/v1/admin/analytics/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return null;
  }

  const body = await res.json();
  return body.data as AnalyticsSummary;
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-input p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function AnalyticsPage() {
  const summary = await fetchSummary();

  if (!summary) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-4">Analytics</h1>
        <p className="text-sm text-muted-foreground">Unable to load analytics.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Analytics</h1>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatTile label="Total Users" value={summary.totalUsers} />
        <StatTile label="Active Circles" value={summary.activeCircles} />
        <StatTile label="Total SOS Events" value={summary.totalSosEvents} />
      </div>

      <h2 className="text-sm font-medium mb-2">SOS Events (last 14 days)</h2>
      {summary.sosEventsPerDay.length === 0 ? (
        <p className="text-sm text-muted-foreground">No SOS events in this window.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-input">
              <th className="py-2 pr-4">Day</th>
              <th className="py-2 pr-4">Count</th>
            </tr>
          </thead>
          <tbody>
            {summary.sosEventsPerDay.map((row) => (
              <tr key={row.day} className="border-b border-input">
                <td className="py-2 pr-4">{new Date(row.day).toLocaleDateString()}</td>
                <td className="py-2 pr-4">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
