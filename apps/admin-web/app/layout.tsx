import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'FindFam Admin',
  description: 'FindFam moderation and monitoring dashboard',
};

// No light/dark toggle exists — the site has one theme. Declaring it here
// (rather than only via Tailwind's `.dark` class) tells the browser itself,
// so native chrome — scrollbars, autofill, the login inputs' caret — also
// renders dark instead of clashing with a light system default.
export const viewport: Viewport = {
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `dark` is forced here, not toggled: FindFam's admin site is monolithic
  // dark by design, not light-with-a-dark-option. Setting the class on <html>
  // server-side means it's present on the very first byte — no flash of the
  // light palette before hydration.
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }}>
      <body className={`${inter.variable} font-sans`}>{children}</body>
    </html>
  );
}
