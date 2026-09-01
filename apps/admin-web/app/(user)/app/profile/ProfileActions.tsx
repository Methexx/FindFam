'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function AvatarUploader({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Image must be under 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/user/avatar', { method: 'POST', body: formData });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not upload that image');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <Avatar url={avatarUrl} name={name} size={72} />
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Change photo
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">JPEG, PNG, or WebP. Up to 5MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function ProfileDetailsForm({
  username,
  displayName,
  phone,
}: {
  username: string;
  displayName: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [usernameValue, setUsernameValue] = useState(username);
  const [displayNameValue, setDisplayNameValue] = useState(displayName ?? '');
  const [phoneValue, setPhoneValue] = useState(phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameValue,
          displayName: displayNameValue.trim().length > 0 ? displayNameValue.trim() : null,
          phone: phoneValue.trim().length > 0 ? phoneValue.trim() : undefined,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not save those changes');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="profile-username">Username</Label>
        <Input
          id="profile-username"
          required
          minLength={3}
          maxLength={32}
          value={usernameValue}
          onChange={(e) => setUsernameValue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-display-name">Name</Label>
        <Input
          id="profile-display-name"
          placeholder="Shown instead of your username where there's room"
          maxLength={100}
          value={displayNameValue}
          onChange={(e) => setDisplayNameValue(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="profile-phone">Phone</Label>
        <Input
          id="profile-phone"
          type="tel"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {saved && !error ? (
        <Alert>
          <AlertDescription>Saved.</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" loading={isSubmitting}>
        Save changes
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/user/auth/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? 'Could not change your password');
        return;
      }
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {success ? (
        <Alert>
          <AlertDescription>
            Password changed. Any other signed-in device has been signed out.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" loading={isSubmitting}>
        Change password
      </Button>
    </form>
  );
}

export function DeactivateAccountButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  async function handleDeactivate() {
    setError(null);
    setIsDeactivating(true);
    try {
      const res = await fetch('/api/user/auth/me/deactivate', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Could not deactivate your account');
        return;
      }
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <div className="space-y-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button type="button" variant="destructive">
            Deactivate my account
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate your account?</DialogTitle>
            <DialogDescription>
              You&apos;ll be signed out everywhere immediately and won&apos;t be able to log back in
              until an admin reactivates your account. This cannot be undone from here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              loading={isDeactivating}
              onClick={handleDeactivate}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
