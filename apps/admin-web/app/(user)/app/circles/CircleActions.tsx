'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * The two ways into a circle, side by side, because they are genuinely
 * equal-weight choices for somebody landing here: start one, or enter the
 * code a family member sent you.
 *
 * Mutations go through /api/user/* (the browser cannot attach the httpOnly
 * bearer itself) and then `router.refresh()` re-runs the Server Component —
 * the same mutate-then-refresh pattern app/dashboard/users/UserActions.tsx
 * uses. No client-side store.
 */
export function CircleActions() {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogTrigger asChild>
          <Button variant="gradient">
            <Plus className="h-4 w-4" />
            Create a circle
          </Button>
        </DialogTrigger>
        <DialogContent>
          <CreateCircleForm
            onDone={() => {
              setCreateOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Ticket className="h-4 w-4" />
            Join with a code
          </Button>
        </DialogTrigger>
        <DialogContent>
          <JoinCircleForm
            onDone={() => {
              setJoinOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateCircleForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/circles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not create the circle');
        return;
      }
      onDone();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Create a circle</DialogTitle>
        <DialogDescription>
          You will get an invite code to share. Only you can see and rotate it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="circle-name">Circle name</Label>
        <Input
          id="circle-name"
          required
          maxLength={100}
          placeholder="Family"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="submit" variant="gradient" loading={isSubmitting}>
          Create circle
        </Button>
      </DialogFooter>
    </form>
  );
}

function JoinCircleForm({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/circles/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await res.json();

      if (!res.ok) {
        // Shown verbatim — "Invalid invite code" and "You are already in this
        // circle" are the backend's wording and are already the right words.
        setError(body.error ?? 'Could not join that circle');
        return;
      }
      onDone();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Join a circle</DialogTitle>
        <DialogDescription>
          Enter the code somebody in the circle sent you. Joining shares your location with everyone
          in it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-1.5">
        <Label htmlFor="invite-code">Invite code</Label>
        <Input
          id="invite-code"
          required
          maxLength={32}
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD2345"
          className="font-mono tracking-[0.2em] uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="submit" variant="gradient" loading={isSubmitting}>
          Join circle
        </Button>
      </DialogFooter>
    </form>
  );
}
