import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  ShieldCheck,
  ArrowRight,
  MapPin,
  Users,
  UserPlus,
  MessageCircle,
  Phone,
  Siren,
  Smartphone,
  Code2,
  Lock,
  EyeOff,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HorizonGlow } from '@/components/ui/horizon-glow';
import { LiveMapMockup } from '@/components/landing/live-map-mockup';
import { Reveal } from '@/components/motion/reveal';
import { cn } from '@/lib/utils';

// The public front door. Rewritten to speak to the people FindFam is for,
// not to the people who built it — the previous version of this page (43
// REST endpoints, architecture diagrams, wire-level journey traces) moved to
// /architecture rather than being deleted, since it's a genuinely useful
// writeup, just not a useful first impression for a non-technical visitor.

export const metadata = {
  title: 'FindFam — Know your family is safe, without watching them',
  description:
    'FindFam lets a family see where each other are, message in a group, and raise an SOS that reaches emergency contacts instantly. Built on consent, not surveillance.',
};

const FEATURES = [
  {
    icon: MapPin,
    title: 'Live map',
    body: 'See where everyone in your circle is right now, updated as they move.',
  },
  {
    icon: Users,
    title: 'Circles & follow requests',
    body: "Nobody sees your location just for knowing your username — sharing starts with a request you accept, and stays undone until you say so.",
  },
  {
    icon: MessageCircle,
    title: 'Group chat',
    body: 'Talk to your circle in the same place you see them on the map.',
  },
  {
    icon: Phone,
    title: 'Emergency contacts',
    body: 'Choose who gets notified first if something goes wrong.',
  },
  {
    icon: Siren,
    title: 'SOS',
    body: "One button shares your location and alerts your circle and emergency contacts immediately. It's not a substitute for calling emergency services.",
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Create an account',
    body: 'Sign up on the FindFam app — it takes a minute and no one can find you by searching.',
  },
  {
    number: '2',
    title: 'Build a circle with people you trust',
    body: 'Send a follow request, they accept, then you add each other to a circle together. Both sides agree before anything is shared.',
  },
  {
    number: '3',
    title: 'See each other, safely',
    body: "Check the map when you want to, chat when you need to, and reach for SOS if something's wrong.",
  },
];

const TECH_STACK = ['Flutter', 'Fastify', 'PostGIS', 'Next.js', 'Redis', 'BullMQ', 'Firebase Cloud Messaging'];

// Honest trust signals, not vanity metrics — FindFam is in closed testing, so
// there is no "10,000+ users" number to put here truthfully. These restate
// guarantees that are already true of the product today.
const TRUST_SIGNALS = [
  { icon: Lock, label: 'Two-sided consent, always' },
  { icon: EyeOff, label: "Can't be found by username alone" },
  { icon: Siren, label: 'SOS is never rate-limited' },
];

export default function HomePage() {
  const hasSession = cookies().has('admin_token');
  const adminHref = hasSession ? '/dashboard' : '/login';
  const adminLabel = hasSession ? 'Open dashboard' : 'Admin login';
  // FEATURES is a fixed, non-empty literal array, so this index is always defined.
  const heroFeature = FEATURES[0]!;
  const restFeatures = FEATURES.slice(1);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-4 z-10 px-4">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between rounded-full border border-glass-border bg-glass px-5 shadow-lg shadow-black/20 backdrop-blur-xl">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-brand" />
            FindFam
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/architecture"
              className="hidden items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground sm:flex"
            >
              <Code2 className="h-3.5 w-3.5" />
              How it&apos;s built
            </Link>
            <Link href={adminHref} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              {adminLabel}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="relative isolate border-b border-border py-16 sm:py-20">
          <HorizonGlow />
          <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Know your family is safe — without watching them.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                FindFam lets a family see where each other are, message in a group, and raise an
                SOS that reaches their emergency contacts. Every sharing relationship needs two
                separate acts of consent — nobody joins your circle without agreeing to it first,
                and you can always see who can see you.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="#get-started" className={buttonVariants({ variant: 'gradient', size: 'lg' })}>
                  Get started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link href="#how-it-works" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
                  How it works
                </Link>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                  <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-brand" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <Reveal>
              <LiveMapMockup />
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-14 border-b border-border py-16">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Getting started
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Three steps, and you&apos;re connected
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map((step) => (
              <Reveal key={step.number}>
                <Card variant="glass">
                  <CardContent className="p-5">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-sm font-semibold text-brand">
                      {step.number}
                    </div>
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-border py-16">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What you get
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a family needs to look out for each other
            </h2>
          </div>

          <div className="space-y-4">
            <Reveal>
              <Card variant="glass" className="overflow-hidden">
                <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                    <heroFeature.icon className="h-6 w-6 text-brand" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium">{heroFeature.title}</h3>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {heroFeature.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Reveal>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {restFeatures.map((feature) => (
                <Reveal key={feature.title}>
                  <Card
                    variant="glass"
                    className={cn(
                      'h-full',
                      feature.title === 'SOS' && 'border-destructive/30 bg-destructive/5',
                    )}
                  >
                    <CardHeader>
                      <div
                        className={cn(
                          'mb-2 flex h-9 w-9 items-center justify-center rounded-md',
                          feature.title === 'SOS' ? 'bg-destructive/15' : 'bg-brand/10',
                        )}
                      >
                        <feature.icon
                          className={cn('h-4 w-4', feature.title === 'SOS' ? 'text-red-400' : 'text-brand')}
                        />
                      </div>
                      <CardTitle className="text-base">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="leading-relaxed">{feature.body}</CardDescription>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Built with */}
        <section className="border-b border-border py-12">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Built on
          </p>
          <Reveal className="flex flex-wrap items-center justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-glass-border bg-glass px-3 py-1 text-xs text-muted-foreground backdrop-blur"
              >
                {tech}
              </span>
            ))}
          </Reveal>
        </section>

        {/* Get started */}
        <section id="get-started" className="scroll-mt-14 border-b border-border py-16">
          <Card variant="glass" className="overflow-hidden border-brand/20">
            <CardContent className="flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 shadow-glow">
                  <Smartphone className="h-5 w-5 text-brand" />
                </div>
                <div>
                  <h3 className="font-medium">FindFam is available on the FindFam Android app</h3>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                    It&apos;s currently in closed testing on Google Play — the fastest way in is an
                    invite from someone already using it. A web app for signing in from a browser
                    is on the way.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>FindFam — family location sharing and personal safety.</p>
          <div className="flex items-center gap-4">
            <p>SOS is not a substitute for calling emergency services.</p>
            <Link href="/architecture" className="underline underline-offset-2 hover:text-foreground">
              How it&apos;s built
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
