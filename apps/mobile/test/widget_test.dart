import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/app.dart';
import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/auth/data/auth_repository.dart';
import 'package:mobile/features/auth/viewmodel/auth_notifier.dart';

void main() {
  testWidgets('FamShareApp shows the login screen when unauthenticated', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          // restoreSession() would otherwise fire a real network call on
          // init - seed state as unauthenticated directly instead.
          authNotifierProvider.overrideWith((ref) => _NoRestoreAuthNotifier()),
        ],
        child: const FamShareApp(),
      ),
    );
    await tester.pump();

    expect(find.text('Log in'), findsWidgets);
  });
}

class _NoRestoreAuthNotifier extends AuthNotifier {
  _NoRestoreAuthNotifier()
      : super(
          AuthRepository(
            apiClient: ApiClient(secureStorage: SecureStorage()),
            secureStorage: SecureStorage(),
          ),
        ) {
    state = const AuthUnauthenticated();
  }

  @override
  Future<void> restoreSession() async {}
}
