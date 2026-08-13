import type { AdminCircleSummary } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminApiGet } from '@/lib/api-client';

export default async function CirclesPage() {
  const result = await adminApiGet<AdminCircleSummary[]>('/api/v1/admin/circles');

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Circles</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {result.reason === 'unauthenticated'
              ? 'Your session has expired. Please log in again.'
              : result.message ?? 'Unable to load circles — the backend request failed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const circles = result.data;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Circles</h1>

      {circles.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No circles yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner ID</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {circles.map((circle) => (
                <TableRow key={circle.id}>
                  <TableCell className="font-medium">{circle.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {circle.ownerId}
                  </TableCell>
                  <TableCell>{circle.memberCount}</TableCell>
                  <TableCell>{new Date(circle.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
