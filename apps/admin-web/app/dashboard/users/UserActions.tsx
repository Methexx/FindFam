'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function UserActions({ userId, suspended }: { userId: string; suspended: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    const action = suspended ? 'unsuspend' : 'suspend';
    const res = await fetch(`/api/admin/users/${userId}/${action}`, { method: 'PATCH' });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? 'Action failed');
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={toggle}
        className={suspended ? undefined : 'border-red-300 text-red-600 hover:bg-red-50'}
      >
        {suspended ? 'Unsuspend' : 'Suspend'}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
