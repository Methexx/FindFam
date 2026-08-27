'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GlowBackdrop } from '@/components/ui/glow-backdrop';

/**
 * One form over two entirely separate auth systems.
 *
 * It tries the user issuer first and falls back to the admin one. The form is
 * shared; the endpoints, tables and signing secrets are not — see
 * docs/06-auth-flow.md on why that isolation is the point and why these must
 * not be merged into a single issuer with a role flag.
 */
export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const userRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: identifier, password }),
      });
      const userBody = await userRes.json();

      if (userRes.ok && userBody.success) {
        router.push('/app');
        router.refresh();
        return;
      }

      // A suspended account is a real answer, not a reason to go on and try
      // the other issuer — the backend returns 403 here specifically so the
      // client can tell it apart from a wrong password.
      if (userRes.status === 403) {
        setError(userBody.error ?? 'This account has been suspended');
        return;
      }

      const adminRes = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
      });
      const adminBody = await adminRes.json();

      if (adminRes.ok && adminBody.success) {
        router.push('/dashboard');
        router.refresh();
        return;
      }

      // Deliberately one message for both failures: which of the two systems
      // holds an account is not something an unauthenticated caller should be
      // able to probe by watching the error text change.
      setError('Those credentials did not match an account');
    } catch {
      setError('Could not reach the server');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <GlowBackdrop />
      <Card variant="glass" className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <ShieldCheck className="h-5 w-5 text-brand" />
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to FindFam</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="text-sm font-medium">
                Username or email
              </label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            New to FindFam?{' '}
            <Link href="/register" className="text-brand underline underline-offset-2">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
