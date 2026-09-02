'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * A separate form from ProfileDetailsForm rather than that one with a mode
 * flag: here phone is required and success means "leave the gate", where on
 * the profile page phone is optional and success means "stay put and show
 * Saved". Sharing one component would mean branching on a flag at every one
 * of those points.
 */
export function CompleteProfileForm({
  username,
  displayName,
  phone,
}: {
  username: string;
  displayName: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [displayNameValue, setDisplayNameValue] = useState(displayName ?? '');
  const [phoneValue, setPhoneValue] = useState(phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayNameValue.trim(),
          phone: phoneValue.trim(),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not save those details');
        return;
      }

      // refresh() re-runs the layout on the server, which is what actually
      // lifts the gate — without it the client would navigate back into a
      // shell that is still rendering the gate from its cached payload.
      router.refresh();
      router.push('/app');
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="setup-display-name">Name</Label>
        <Input
          id="setup-display-name"
          required
          maxLength={100}
          placeholder={`What people should see instead of ${username}`}
          value={displayNameValue}
          onChange={(e) => setDisplayNameValue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="setup-phone">Phone</Label>
        <Input
          id="setup-phone"
          type="tel"
          required
          placeholder="+15555550100"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used as the fallback contact number on an SOS.
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" loading={isSubmitting} className="w-full">
        Save and continue
      </Button>
    </form>
  );
}

export function SkipSetupButton() {
  const router = useRouter();
  const [isSkipping, setIsSkipping] = useState(false);

  async function handleSkip() {
    setIsSkipping(true);
    try {
      await fetch('/api/user/skip-profile-setup', { method: 'POST' });
      router.refresh();
      router.push('/app');
    } finally {
      setIsSkipping(false);
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" loading={isSkipping} onClick={handleSkip}>
      Skip for now
    </Button>
  );
}
