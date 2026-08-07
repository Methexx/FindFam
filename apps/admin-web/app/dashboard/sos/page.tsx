import { cookies } from 'next/headers';
import type { AdminSosEvent } from '@findfam/shared-types';
import SosLiveFeed from './SosLiveFeed';

async function fetchActiveSos(): Promise<AdminSosEvent[]> {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return [];
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const res = await fetch(`${apiBaseUrl}/api/v1/admin/sos/active`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    return [];
  }

  const body = await res.json();
  return body.data as AdminSosEvent[];
}

export default async function SosPage() {
  const initialEvents = await fetchActiveSos();
  return <SosLiveFeed initialEvents={initialEvents} />;
}
