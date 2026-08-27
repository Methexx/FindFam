import Link from 'next/link';
import { cookies } from 'next/headers';
import {
  ShieldCheck,
  ArrowRight,
  MapPin,
  Users,
  MessageCircle,
  Phone,
  Siren,
  Code2,
  Lock,
  EyeOff,
  Ticket,
  Car,
  Home,
  GraduationCap,
  HeartHandshake,
  Briefcase,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HorizonGlow } from '@/components/ui/horizon-glow';
import { Reveal } from '@/components/motion/reveal';
import { AppPreview } from '@/components/landing/app-preview';
import { Faq } from '@/components/landing/faq';
import { ADMIN_TOKEN_COOKIE, USER_REFRESH_TOKEN_COOKIE } from '@/lib/user-session';
import { cn } from '@/lib/utils';

// The public front door. Written for the people FindFam is for, not the
// people who built it — the engineering writeup this page used to be lives
// at /architecture, where it is still a good and honest artifact.

export const metadata = {
  title: 'FindFam — Know your family is safe, without watching them',
  description:
    'FindFam lets a family see where each other are, message in a group, and raise an SOS that reaches emergency contacts instantly. Built on consent, not surveillance.',
};

const FEATURES = [
  {
    icon: MapPin,
    title: 'Live map',
    body: 'See where everyone in your circle is right now, updated as they move — in the app or in a browser.',
  },
  {
    icon: Ticket,
    title: 'Circles you join, not get added to',
    body: 'Start a circle and share its invite code, or enter a code somebody sent you. Both ends are a choice somebody made.',
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
    body: 'Sign up in a browser or on the app. It takes a minute, and no one can find you by searching for your username.',
  },
  {
    number: '2',
    title: 'Create a circle, or join one with a code',
    body: 'Start a circle and send people its invite code, or type in the code somebody sent you. Either way, both sides chose it.',
  },
  {
    number: '3',
    title: 'See each other, safely',
    body: "Check the map when you want to, chat when you need to, and reach for SOS if something's wrong.",
  },
];

// Honest trust signals, not vanity metrics — FindFam is in closed testing, so
// there is no "10,000+ users" number to put here truthfully. These restate
// guarantees that are already true of the product today.
const TRUST_SIGNALS = [
  { icon: Lock, label: 'Both sides choose, always' },
  { icon: EyeOff, label: "Can't be found by username alone" },
  { icon: Siren, label: 'SOS is never rate-limited' },
];

const AUDIENCES = [
  {
    icon: GraduationCap,
    title: 'Parents and teenagers',
    body: 'Know they got there without texting to ask. They can see you too — it goes both ways by design.',
  },
  {
    icon: HeartHandshake,
    title: 'Grown children and parents',
    body: 'Keep an eye out for someone living alone, with their agreement and their ability to stop at any time.',
  },
  {
    icon: Home,
    title: 'Housemates',
    body: 'A small circle for the people you live with, without any of it touching your wider contacts.',
  },
  {
    icon: Car,
    title: 'Road trips',
    body: 'Two cars, one map. Everybody can see where the other one got to without a phone call at every junction.',
  },
  {
    icon: Users,
    title: 'Nights out',
    body: 'A circle that exists for one evening. Delete it in the morning and nothing is left behind.',
  },
  {
    icon: Briefcase,
    title: 'Small teams',
    body: 'People working across a site or a city, sharing while they are on shift and not a minute longer.',
  },
];

const PRIVACY_POINTS = [
  {
    title: 'Two things have to happen',
    body: 'Either the circle owner hands you an invite code and you enter it, or you and somebody follow each other and they add you. There is no path where you end up shared without doing something yourself.',
  },
  {
    title: 'You can always see who can see you',
    body: 'Every circle lists its members. Leave a circle and your location stops going to it immediately.',
  },
  {
    title: 'Nobody finds you by searching',
    body: 'There is no user directory and no search. Somebody needs your exact username, or a code you gave them.',
  },
  {
    title: 'The browser says what it can actually do',
    body: 'Sharing from a browser tab stops when the tab closes, and the indicator says so rather than implying cover it does not have.',
  },
];

const FAQ_ENTRIES = [
  {
    question: 'Is this tracking people without them knowing?',
    answer:
      'No, and it is built so it cannot be. Somebody joins a circle by entering a code they were given, or by being added after the two of you already follow each other. Every member of a circle can see the full member list, and leaving takes one tap.',
  },
  {
    question: 'Do I need the phone app, or is the browser enough?',
    answer:
      'You can register, create and join circles, and watch your circle on the live map entirely in a browser. Two things stay on the phone: raising an SOS, and sharing your location in the background. A browser can only share while its tab is open, and there is no way around that on the web.',
  },
  {
    question: 'What is an invite code?',
    answer:
      'Every circle has a short code that only its owner can see. Send it to somebody and they can join by typing it in. If it ends up somewhere it should not, the owner rotates it and the old code stops working immediately — people already in the circle stay in.',
  },
  {
    question: 'Can I stop sharing without leaving the circle?',
    answer:
      'Yes. Sharing is a switch, not a condition of membership. You stay in the circle, keep the chat, and simply stop broadcasting a position.',
  },
  {
    question: 'What happens when someone loses signal?',
    answer:
      'Their pin fades and picks up a clock badge once their last position is more than five minutes old, and the list says "last seen" instead of "updated". A map that showed an hours-old position as if it were current would be worse than showing nothing.',
  },
  {
    question: 'Is SOS a replacement for calling emergency services?',
    answer:
      'No. SOS tells your circle and your emergency contacts where you are, immediately and without rate limiting. It does not contact police, fire or ambulance. If you are in danger, call your local emergency number.',
  },
];

const TECH_STACK = ['Flutter', 'Fastify', 'PostGIS', 'Next.js', 'Redis', 'BullMQ', 'Firebase Cloud Messaging'];

export default function HomePage() {
  const jar = cookies();
  // Three states, not two: the same browser can hold an admin session, a user
  // session, or neither, and sending an admin to /app (or a user to
  // /dashboard) would just bounce them off middleware. Keyed on the refresh
  // token, not the 15-minute access token, so somebody returning to a tab
  // after lunch is still greeted as signed in.
  const hasUserSession = jar.has(USER_REFRESH_TOKEN_COOKIE);
  const hasAdminSession = jar.has(ADMIN_TOKEN_COOKIE);

  const primaryHref = hasUserSession ? '/app' : '/register';
  const primaryLabel = hasUserSession ? 'Open FindFam' : 'Get started';

  return (
    <div className="relative isolate min-h-screen bg-background">
      <header className="sticky top-4 z-20 px-4">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between rounded-full border border-glass-border bg-glass px-5 shadow-lg shadow-black/20 backdrop-blur-xl">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5 text-brand" />
            FindFam
          </span>

          <nav className="flex items-center gap-1 sm:gap-4">
            <Link
              href="#how-it-works"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              How it works
            </Link>
            <Link
              href="#features"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              Features
            </Link>
            <Link
              href="#faq"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              FAQ
            </Link>

            {hasAdminSession ? (
              <Link href="/dashboard" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                Open dashboard
              </Link>
            ) : (
              <>
                {!hasUserSession ? (
                  <Link
                    href="/login"
                    className="px-2 text-sm text-muted-foreground hover:text-foreground"
                  >
                    Log in
                  </Link>
                ) : null}
                <Link href={primaryHref} className={buttonVariants({ variant: 'gradient', size: 'sm' })}>
                  {primaryLabel}
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="relative pt-16 sm:pt-20">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Know your family is safe — without watching them.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            FindFam lets a family see where each other are, message in a group, and raise an SOS
            that reaches their emergency contacts. Nobody joins your circle without choosing to, and
            you can always see who can see you.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={primaryHref} className={buttonVariants({ variant: 'gradient', size: 'lg' })}>
              {primaryLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="#how-it-works" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              How it works
            </Link>
          </div>

          <HorizonGlow className="mt-8" />

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className="h-3.5 w-3.5 text-brand" />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* The product, immediately */}
        <section className="pb-16 pt-10">
          <Reveal>
            <AppPreview />
          </Reveal>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            The circle map, in a browser. Faded pins are positions older than five minutes.
          </p>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 border-t border-border py-16">
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
                <Card variant="glass" className="h-full">
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
        <section id="features" className="scroll-mt-24 border-t border-border py-16">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              What you get
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a family needs to look out for each other
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
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
        </section>

        {/* Who it's for */}
        <section className="border-t border-border py-16">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Who it&apos;s for
            </p>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              A circle is whoever you decide it is
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIENCES.map((audience) => (
              <Reveal key={audience.title}>
                <Card variant="glass" className="h-full">
                  <CardContent className="p-5">
                    <audience.icon className="mb-3 h-5 w-5 text-brand" />
                    <h3 className="font-medium">{audience.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {audience.body}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Privacy & consent */}
        <section id="privacy" className="scroll-mt-24 border-t border-border py-16">
          <div className="grid gap-10 lg:grid-cols-[22rem_1fr]">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Privacy
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Consent isn&apos;t a setting here. It&apos;s the only way in.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Plenty of apps can follow somebody who never agreed to it. FindFam is built so that
                is not possible — not discouraged, not off by default, but absent.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {PRIVACY_POINTS.map((point) => (
                <Reveal key={point.title}>
                  <Card variant="glass" className="h-full">
                    <CardContent className="p-5">
                      <h3 className="font-medium">{point.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {point.body}
                      </p>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-24 border-t border-border py-16">
          <div className="grid gap-10 lg:grid-cols-[22rem_1fr]">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Questions
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                The things people ask first
              </h2>
            </div>
            <Faq entries={FAQ_ENTRIES} />
          </div>
        </section>

        {/* Built on */}
        <section className="border-t border-border py-10">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Built on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {TECH_STACK.map((tech) => (
              <span
                key={tech}
                className="rounded-full border border-glass-border bg-glass px-3 py-1 text-xs text-muted-foreground backdrop-blur"
              >
                {tech}
              </span>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-border py-16">
          <Card variant="glass" className="overflow-hidden border-brand/20">
            <CardContent className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-medium">Start a circle in about a minute</h3>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Sign up in your browser, create a circle, and send someone the code. The Android
                  app is in closed testing and adds background sharing and SOS.
                </p>
              </div>
              <Link
                href={primaryHref}
                className={cn(buttonVariants({ variant: 'gradient', size: 'lg' }), 'shrink-0')}
              >
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-brand" />
              FindFam
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              Family location sharing and personal safety, built on consent.
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Product
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="#features" className="hover:text-foreground">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#how-it-works" className="hover:text-foreground">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="#faq" className="hover:text-foreground">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="/register" className="hover:text-foreground">
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-foreground">
                  Log in
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              More
            </p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                <Link href="#privacy" className="hover:text-foreground">
                  Privacy &amp; consent
                </Link>
              </li>
              <li>
                <Link href="/architecture" className="flex items-center gap-1.5 hover:text-foreground">
                  <Code2 className="h-3.5 w-3.5" />
                  How it&apos;s built
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-6xl border-t border-border px-6 pt-6 text-sm text-muted-foreground">
          <p>SOS is not a substitute for calling emergency services.</p>
        </div>
      </footer>
    </div>
  );
}
