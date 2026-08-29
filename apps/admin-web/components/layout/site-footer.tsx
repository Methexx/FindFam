import Link from 'next/link';
import { ShieldCheck, Code2, ArrowUp } from 'lucide-react';

const COLUMNS = [
  {
    heading: 'Product',
    links: [
      { href: '#features', label: 'Features' },
      { href: '#how-it-works', label: 'How it works' },
      { href: '#faq', label: 'FAQ' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { href: '/register', label: 'Create an account' },
      { href: '/login', label: 'Log in' },
    ],
  },
  {
    heading: 'More',
    links: [
      { href: '#privacy', label: 'Privacy & consent' },
      { href: '/architecture', label: "How it's built", icon: Code2 },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="flex items-center gap-2 font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-brand" />
              FindFam
            </span>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Family location sharing and personal safety, built on consent.
            </p>
            {/* An honest status, not a growth badge. There is no user count
                worth printing here, and inventing social proof on a safety
                product would be the wrong kind of polish. */}
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass px-2.5 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              In closed testing
            </span>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {column.heading}
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
                    >
                      {'icon' in link && link.icon ? <link.icon className="h-3.5 w-3.5" /> : null}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>SOS is not a substitute for calling emergency services.</p>
          {/* A plain anchor to the page top rather than a scroll handler: it
              works without JavaScript and honours the reduced-motion override
              on scroll-behavior in globals.css. */}
          <Link
            href="#top"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Back to top
          </Link>
        </div>
      </div>
    </footer>
  );
}
