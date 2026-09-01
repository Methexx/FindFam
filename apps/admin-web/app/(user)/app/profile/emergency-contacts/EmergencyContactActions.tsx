'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function AddContactForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/emergency-contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          phone: phone.trim().length > 0 ? phone.trim() : undefined,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not add that contact');
        return;
      }
      setUsername('');
      setPhone('');
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
            <Label htmlFor="contact-username">Add a contact</Label>
            <p className="text-sm text-muted-foreground">
              Their exact username. Optionally, a phone number shown alongside them here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input
              id="contact-username"
              required
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="min-w-[10rem] flex-1"
            />
            <Input
              type="tel"
              placeholder="phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="min-w-[10rem] flex-1"
            />
            <Button type="submit" variant="outline" loading={isSubmitting}>
              {isSubmitting ? null : <ShieldPlus className="h-4 w-4" />}
              Add
            </Button>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

export function RemoveContactButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [isRemoving, setIsRemoving] = useState(false);

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await fetch(`/api/user/emergency-contacts/${contactId}`, { method: 'DELETE' });
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
