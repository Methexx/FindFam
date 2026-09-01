import type { User } from '@findfam/shared-types';

/**
 * One definition of "complete", imported by the layout gate, the
 * completion page and the home-page nudge — three places that would
 * otherwise drift apart and start disagreeing about whether to prompt.
 *
 * Deliberately only name + phone. A profile photo is optional (uploads
 * 503 until Supabase Storage is configured, so requiring one would be a
 * lockout), and an emergency contact is impossible for a new account —
 * `addContact` rejects anyone you don't already mutually follow, which a
 * fresh sign-up has none of.
 */
export function isProfileComplete(user: User): boolean {
  return (
    (user.displayName?.trim().length ?? 0) > 0 && (user.phone?.trim().length ?? 0) > 0
  );
}

/** Session-scoped, so the gate re-prompts on the next sign-in. */
export const PROFILE_SETUP_SKIPPED_COOKIE = 'profile_setup_skipped';
