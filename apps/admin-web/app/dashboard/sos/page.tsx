import type { AdminSosEvent } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { adminApiGet } from '@/lib/api-client';
import SosLiveFeed from './SosLiveFeed';

export default async function SosPage() {
  const result = await adminApiGet<AdminSosEvent[]>('/api/v1/admin/sos/active');

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">SOS</h1>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {result.reason === 'unauthenticated'
              ? 'Your session has expired. Please log in again.'
              : result.message ?? 'Unable to load active SOS events — the backend request failed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <SosLiveFeed initialEvents={result.data} />;
}
