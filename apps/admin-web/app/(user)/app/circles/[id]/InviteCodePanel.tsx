'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Owner-only. The server sends `inviteCode: null` to everybody else, so this
 * component is simply not rendered for them — the visibility rule lives in
 * one place (circles.service.ts), not in a client-side check that could be
 * bypassed by reading the payload.
 */
export function InviteCodePanel({ circleId, inviteCode }: { circleId: string; inviteCode: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, permissions).
      // The code is on screen and selectable, so this is not worth an error.
    }
  }

  async function handleRotate() {
    setError(null);
    setIsRotating(true);
    try {
      const res = await fetch(`/api/user/circles/${circleId}/invite-code/rotate`, {
        method: 'POST',
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not rotate the code');
        return;
      }
      router.refresh();
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsRotating(false);
    }
  }

  return (
    <Card variant="glass">
      <CardContent className="space-y-3 p-5">
        <div>
          <h2 className="font-medium">Invite code</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Anyone with this code can join the circle and will see where everyone is. Only you can
            see it.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-md border border-glass-border bg-glass px-3 py-2 font-mono text-lg tracking-[0.25em]">
            {inviteCode}
          </code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRotate}
            disabled={isRotating}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {isRotating ? 'Rotating…' : 'Rotate'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Rotating stops the old code working immediately. People already in the circle stay in.
        </p>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
