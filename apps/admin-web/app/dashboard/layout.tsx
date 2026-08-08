import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <nav className="flex gap-4 border-b border-input px-6 py-3 text-sm font-medium">
        <Link href="/dashboard/circles">Circles</Link>
        <Link href="/dashboard/sos">SOS</Link>
        <Link href="/dashboard/users">Users</Link>
        <Link href="/dashboard/analytics">Analytics</Link>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
