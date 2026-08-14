import { Users, Radio, TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminApiGet } from '@/lib/api-client';

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
