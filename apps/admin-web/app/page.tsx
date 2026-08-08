import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default function HomePage() {
  const hasSession = cookies().has('admin_token');
  redirect(hasSession ? '/dashboard' : '/login');
}
