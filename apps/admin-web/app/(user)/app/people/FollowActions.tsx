'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function SendFollowRequestForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSentTo(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followeeUsername: username }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not send that request');
        return;
      }

      setSentTo(username);
      setUsername('');
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card variant="glass">
      <CardContent className="p-5">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="follow-username">Follow someone</Label>
            <p className="text-sm text-muted-foreground">
              They have to accept before anything is shared. You need their exact username — people
              cannot be found by searching.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              id="follow-username"
              required
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Button type="submit" variant="outline" loading={isSubmitting}>
              {isSubmitting ? null : <UserPlus className="h-4 w-4" />}
              Send
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {sentTo ? (
            <Alert>
              <AlertDescription>
                Request sent to {sentTo}. They will see it next time they open FindFam.
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function RespondToFollowButtons({ followId }: { followId: string }) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<'accept' | 'reject' | null>(null);

  async function respond(action: 'accept' | 'reject') {
    setPendingAction(action);
    try {
      await fetch(`/api/user/follows/${followId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pendingAction !== null}
        onClick={() => respond('reject')}
      >
        Reject
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={pendingAction !== null}
        loading={pendingAction === 'accept'}
        onClick={() => respond('accept')}
      >
        Accept
      </Button>
    </div>
  );
}

export function RemoveFollowButton({ followId }: { followId: string }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await fetch(`/api/user/follows/${followId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" loading={isRemoving} onClick={handleRemove}>
      Remove
    </Button>
  );
}
