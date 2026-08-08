import { cookies } from 'next/headers';
import { Users, Radio, TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage() {
  const summary = await fetchSummary();

  if (!summary) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Analytics</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Unable to load analytics.
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No SOS events in this window.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.sosEventsPerDay.map((row) => (
                  <TableRow key={row.day}>
                    <TableCell>{new Date(row.day).toLocaleDateString()}</TableCell>
                    <TableCell>{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
