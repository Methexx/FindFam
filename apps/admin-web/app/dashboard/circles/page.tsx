import { cookies } from 'next/headers';
import type { AdminCircleSummary } from '@famshare/shared-types';

async function fetchCircles(): Promise<AdminCircleSummary[]> {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return [];
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiBaseUrl}/api/v1/admin/circles`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return [];
  }

  const body = await res.json();
  return body.data as AdminCircleSummary[];
}

export default async function CirclesPage() {
  const circles = await fetchCircles();

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Circles</h1>

      {circles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No circles yet.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-input">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Owner ID</th>
              <th className="py-2 pr-4">Members</th>
              <th className="py-2 pr-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {circles.map((circle) => (
              <tr key={circle.id} className="border-b border-input">
                <td className="py-2 pr-4">{circle.name}</td>
                <td className="py-2 pr-4 font-mono text-xs">{circle.ownerId}</td>
                <td className="py-2 pr-4">{circle.memberCount}</td>
                <td className="py-2 pr-4">{new Date(circle.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
