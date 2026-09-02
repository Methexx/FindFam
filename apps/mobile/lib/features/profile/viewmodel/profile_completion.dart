import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/domain/user.dart';
import '../../auth/viewmodel/auth_notifier.dart';

/// One definition of "complete", matching lib/profile-completion.ts on the
/// web so the two platforms cannot disagree about whether to prompt.
///
/// Deliberately only name + phone. A profile photo is optional (uploads 503
/// until Supabase Storage is configured), and an emergency contact is
/// impossible for a new account — addContact rejects anyone you do not
/// already mutually follow, which a fresh sign-up has none of.
bool isProfileComplete(User user) {
  return (user.displayName?.trim().isNotEmpty ?? false) &&
      (user.phone?.trim().isNotEmpty ?? false);
}

/// The signed-in user, or null when not authenticated — saves every caller
/// re-doing the `is AuthAuthenticated` pattern match.
final authUserProvider = Provider<User?>((ref) {
  final authState = ref.watch(authNotifierProvider);
  return authState is AuthAuthenticated ? authState.user : null;
});

/// Deliberately in-memory rather than persisted to SecureStorage: that holds
/// only tokens and is cleared on logout, and "forget the skip on next
/// launch" is exactly the behaviour we want — the gate should keep asking
/// until the profile is actually filled in.
final profileSetupSkippedProvider = StateProvider<bool>((ref) => false);

/// Whether to show the setup screen instead of the app. Extracted from the
/// switch in app.dart so it can be asserted directly — pumping the whole app
/// for the "not gated" case would boot the real SOS/WebSocket stack.
bool shouldGateForSetup({required User user, required bool skipped}) {
  return !isProfileComplete(user) && !skipped;
}
