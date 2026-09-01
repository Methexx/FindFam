import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/domain/user.dart';
import 'package:mobile/features/auth/viewmodel/auth_notifier.dart';
import 'package:mobile/features/profile/viewmodel/profile_completion.dart';

User _user({String? displayName, String? phone}) => User(
      id: 'u1',
      username: 'newuser',
      displayName: displayName,
      email: 'newuser@example.com',
      phone: phone,
      avatarUrl: null,
      isSharing: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: null,
    );

void main() {
  group('profile completion gate', () {
    testWidgets('a freshly registered account is sent to the setup screen', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authNotifierProvider.overrideWith((ref) => _SeededAuthNotifier(_user())),
          ],
          child: const FindFamApp(),
        ),
      );
      await tester.pump();

      expect(find.text('Finish setting up'), findsOneWidget);
      expect(find.text('Save and continue'), findsOneWidget);
    });

    // The "falls through to the app" cases are asserted on the gate
    // condition rather than by pumping FindFamApp: HomePlaceholderScreen
    // boots the real SOS/WebSocket stack on mount, which a widget test has
    // no backend for — the same reason widget_test.dart only ever pumps the
    // unauthenticated case.
    test('a complete profile is not gated', () {
      expect(
        shouldGateForSetup(
          user: _user(displayName: 'New User', phone: '+15555550100'),
          skipped: false,
        ),
        isFalse,
      );
    });

    test('an incomplete profile is gated until skipped', () {
      expect(shouldGateForSetup(user: _user(), skipped: false), isTrue);
      expect(shouldGateForSetup(user: _user(), skipped: true), isFalse);
    });

    test('isProfileComplete requires both a name and a phone', () {
      expect(isProfileComplete(_user()), isFalse);
      expect(isProfileComplete(_user(displayName: 'A')), isFalse);
      expect(isProfileComplete(_user(phone: '+1')), isFalse);
      // Whitespace is not a name — the web helper trims too.
      expect(isProfileComplete(_user(displayName: '   ', phone: '+1')), isFalse);
      expect(isProfileComplete(_user(displayName: 'A', phone: '+1')), isTrue);
    });
  });
}

class _SeededAuthNotifier extends AuthNotifier {
  _SeededAuthNotifier(User user)
      : super(
          AuthRepository(
            apiClient: ApiClient(secureStorage: SecureStorage()),
            secureStorage: SecureStorage(),
          ),
        ) {
    state = AuthAuthenticated(user);
  }

  @override
  Future<void> restoreSession() async {}
}
