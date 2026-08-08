'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function UserSearch({ initialSearch }: { initialSearch: string }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    router.push(`/dashboard/users${params.toString() ? `?${params}` : ''}`);
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by username or email"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-md border border-input px-3 py-2 text-sm hover:bg-accent"
      >
        Search
      </button>
    </form>
  );
}
