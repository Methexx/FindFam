'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus, LogOut, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function AddMemberForm({ circleId }: { circleId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsFollow, setNeedsFollow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNeedsFollow(false);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/user/circles/${circleId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const body = await res.json();

      if (!res.ok) {
        // The mutual-follow rule is the one error here a user can actually
        // act on, and the raw sentence does not say where to go — so it gets
        // a link instead of being dropped on the floor as generic red text.
        if (res.status === 403) setNeedsFollow(true);
        setError(body.error ?? 'Could not add that person');
        return;
      }

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
          <div className="space-y-1.5">
            <Label htmlFor="add-member">Add someone you follow</Label>
            <p className="text-sm text-muted-foreground">
              You and they must already follow each other. Or just send them the invite code above.
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              id="add-member"
              required
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Button type="submit" variant="outline" loading={isSubmitting}>
              {isSubmitting ? null : <UserPlus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error}
                {needsFollow ? (
                  <>
                    {' '}
                    <Link href="/app/people" className="underline underline-offset-2">
                      Send a follow request
                    </Link>
                    .
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function RemoveMemberButton({
  circleId,
  userId,
  username,
}: {
  circleId: string;
  userId: string;
  username: string;
}) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await fetch(`/api/user/circles/${circleId}/members/${userId}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      loading={isRemoving}
      aria-label={`Remove ${username}`}
    >
      Remove
    </Button>
  );
}

/**
 * One control with two meanings, because the server has two rules: a member
 * leaves, and an owner cannot — `removeMember` refuses an owner leaving with
 * a 400 and tells them to delete instead. Rather than let somebody discover
 * that by hitting the error, the owner is simply offered Delete.
 */
export function LeaveOrDeleteButton({
  circleId,
  circleName,
  isOwner,
  selfUserId,
}: {
  circleId: string;
  circleName: string;
  isOwner: boolean;
  selfUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setError(null);
    setIsSubmitting(true);
    try {
      const url = isOwner
        ? `/api/user/circles/${circleId}`
        : `/api/user/circles/${circleId}/members/${selfUserId}`;
      const res = await fetch(url, { method: 'DELETE' });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'That did not work');
        return;
      }

      setOpen(false);
      router.push('/app/circles');
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {isOwner ? (
          <>
            <Trash2 className="h-3.5 w-3.5" />
            Delete circle
          </>
        ) : (
          <>
            <LogOut className="h-3.5 w-3.5" />
            Leave circle
          </>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isOwner ? `Delete ${circleName}?` : `Leave ${circleName}?`}</DialogTitle>
            <DialogDescription>
              {isOwner
                ? 'Everyone in it stops seeing each other. This cannot be undone, and the invite code stops working.'
                : 'You will stop sharing your location with this circle and stop seeing theirs.'}
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirm}
              loading={isSubmitting}
            >
              {isOwner ? 'Delete circle' : 'Leave circle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
