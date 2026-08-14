import Link from 'next/link';
import { cookies } from 'next/headers';
import { ShieldCheck, ArrowLeft, ArrowRight, MapPin, Siren, Users } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchitectureDiagram } from '@/components/landing/architecture-diagram';
import { JourneyTrace } from '@/components/landing/journey';
import { JOURNEYS, SURFACES, DECISIONS } from '@/lib/landing-content';
import { GlowBackdrop } from '@/components/ui/glow-backdrop';

// The technical writeup, moved here from `/` so the front door can be a
// product page for people who aren't developers. This page is unchanged in
// content — it's the same architecture trace, journeys and design decisions,
// just no longer the first thing a visitor sees.

export const metadata = {
  title: 'FindFam — Architecture',
  description:
    'How FindFam works under the hood: architecture, the realtime location path, and the SOS delivery flow, traced end to end.',
};

function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      {lead ? <p className="mt-3 leading-relaxed text-muted-foreground">{lead}</p> : null}
    </div>
  );
}

export default function ArchitecturePage() {
  const hasSession = cookies().has('admin_token');
  const adminHref = hasSession ? '/dashboard' : '/login';
  const adminLabel = hasSession ? 'Open dashboard' : 'Admin login';

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-brand" />
            FindFam
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to FindFam
            </Link>
            <Link href={adminHref} className={buttonVariants({ size: 'sm' })}>
              {adminLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="relative border-b border-border py-16 sm:py-20">
          <GlowBackdrop />
          <Badge variant="secondary" className="mb-5">
            Flutter · Fastify · PostGIS · Next.js
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            How FindFam actually works.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            This page traces the system end to end — the architecture, and then three real
            journeys through the code, down to the request bodies and channel names. It&apos;s
            written for engineers; the product itself is described at{' '}
            <Link href="/" className="underline underline-offset-2 hover:text-foreground">
              the front page
            </Link>
            .
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="#journeys" className={buttonVariants({ size: 'lg' })}>
              See how it works
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href={adminHref} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              {adminLabel}
            </Link>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-border pt-8 sm:grid-cols-4">
            {[
              { value: '3', label: 'Applications, one monorepo' },
              { value: '43', label: 'REST endpoints across 9 modules' },
              { value: '15', label: 'Database migrations' },
              { value: '65', label: 'Backend integration tests' },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-md border border-glass-border bg-glass px-4 py-3 backdrop-blur"
              >
                <dt className="text-2xl font-semibold tabular-nums">{stat.value}</dt>
                <dd className="mt-1 text-sm leading-snug text-muted-foreground">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* What it's made of */}
        <section className="border-b border-border py-16">
          <SectionHeading
            eyebrow="The system"
            title="Three surfaces, one backend"
            lead="A Flutter app for families, a Fastify service that owns all the logic, and a Next.js dashboard for moderation. They share one database and one WebSocket gateway."
          />

          <div className="grid gap-4 md:grid-cols-3">
            {SURFACES.map((surface) => (
              <Card key={surface.name} variant="glass">
                <CardHeader>
                  <CardTitle>{surface.name}</CardTitle>
                  <CardDescription>{surface.role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 font-mono text-xs text-muted-foreground">{surface.stack}</p>
                  <ul className="space-y-2">
                    {surface.points.map((point) => (
                      <li
                        key={point}
                        className="flex gap-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-border" />
                        {point}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Architecture */}
        <section className="border-b border-border py-16">
          <SectionHeading
            eyebrow="Architecture"
            title="How the pieces fit"
            lead="Requests take HTTPS. Anything live — location, chat, SOS — takes a WebSocket. Redis sits between the gateway and its subscribers, and the queue exists for exactly one job."
          />
          <ArchitectureDiagram />
        </section>

        {/* Journeys */}
        <section id="journeys" className="scroll-mt-14 border-b border-border py-16">
          <SectionHeading
            eyebrow="Worked examples"
            title="Three journeys, traced through the code"
            lead="One family, followed from signing up to raising an alarm. The endpoints, payloads and channel names below are the real ones."
          />

          <div className="space-y-14">
            {JOURNEYS.map((journey) => (
              <JourneyTrace key={journey.id} journey={journey} />
            ))}
          </div>
        </section>

        {/* Design decisions */}
        <section className="border-b border-border py-16">
          <SectionHeading
            eyebrow="Design decisions"
            title="Choices worth defending"
            lead="The parts where an obvious shortcut existed and was deliberately not taken."
          />

          <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
            {DECISIONS.map((decision) => (
              <div
                key={decision.title}
                className="rounded-md border border-glass-border bg-glass p-4 backdrop-blur"
              >
                <h3 className="text-sm font-medium">{decision.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {decision.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Admin */}
        <section className="py-16">
          <SectionHeading
            eyebrow="This site"
            title="The moderation dashboard"
            lead="Alongside the product, this app also hosts the admin surface. It signs in with its own credentials — admin accounts are a separate table, signed with a separate secret, and no user token can reach these routes."
          />

          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Siren,
                title: 'Live SOS feed',
                body: 'Subscribes to the admin:sos channel. Events appear the moment they are raised, alongside the ones already active.',
              },
              {
                icon: Users,
                title: 'User moderation',
                body: 'Search, suspend and unsuspend. Suspending closes the live socket and revokes refresh tokens, so it takes effect immediately.',
              },
              {
                icon: MapPin,
                title: 'Circles and analytics',
                body: 'Circle membership at a glance, plus counts and an SOS trend for the recent period.',
              },
            ].map((item) => (
              <Card key={item.title} variant="glass">
                <CardHeader>
                  <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-brand/10">
                    <item.icon className="h-4 w-4 text-brand" />
                  </div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Link href={adminHref} className={buttonVariants({ size: 'lg' })}>
            {adminLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>FindFam — family location sharing and personal safety.</p>
          <p>SOS is not a substitute for calling emergency services.</p>
        </div>
      </footer>
    </div>
  );
}
