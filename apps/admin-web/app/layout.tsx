import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FamShare Admin',
  description: 'FamShare moderation and monitoring dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
