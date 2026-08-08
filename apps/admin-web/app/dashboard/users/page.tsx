import { cookies } from 'next/headers';
import type { AdminUser } from '@findfam/shared-types';
import UserSearch from './UserSearch';
import UserActions from './UserActions';

interface ListUsersResult {
  users: AdminUser[];
  nextCursor: string | null;
}

async function fetchUsers(search?: string): Promise<ListUsersResult> {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return { users: [], nextCursor: null };
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const res = await fetch(`${apiBaseUrl}/api/v1/admin/users?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return { users: [], nextCursor: null };
  }

  const body = await res.json();
  return body.data as ListUsersResult;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const search = searchParams.search ?? '';
  const { users } = await fetchUsers(search);

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Users</h1>
      <UserSearch initialSearch={search} />

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No users found.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-input">
              <th className="py-2 pr-4">Username</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Created</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-input">
                <td className="py-2 pr-4">{user.username}</td>
                <td className="py-2 pr-4">{user.email}</td>
                <td className="py-2 pr-4">
                  {user.suspended ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      Suspended
                    </span>
                  ) : (
                    <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                      Active
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4">
                  <UserActions userId={user.id} suspended={user.suspended} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
