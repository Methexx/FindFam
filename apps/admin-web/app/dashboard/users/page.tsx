import type { AdminUser } from '@findfam/shared-types';
import UserSearch from './UserSearch';
import UserActions from './UserActions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { adminApiGet } from '@/lib/api-client';

interface ListUsersResult {
  users: AdminUser[];
  nextCursor: string | null;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const search = searchParams.search ?? '';
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const result = await adminApiGet<ListUsersResult>(`/api/v1/admin/users?${params}`);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Users</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {result.reason === 'unauthenticated'
              ? 'Your session has expired. Please log in again.'
              : result.message ?? 'Unable to load users — the backend request failed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { users } = result.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Users</h1>
        <UserSearch initialSearch={search} />
      </div>

      {users.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    {user.suspended ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <UserActions userId={user.id} suspended={user.suspended} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
