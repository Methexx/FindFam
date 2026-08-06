import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/circles/data/follows_repository.dart';
import 'package:mobile/features/circles/ui/follows_screen.dart';
import 'package:mobile/features/circles/viewmodel/follows_notifier.dart';

void main() {
  testWidgets('shows the empty state when there are no pending requests', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          followsNotifierProvider.overrideWith((ref) => _LoadedEmptyFollowsNotifier()),
        ],
        child: const MaterialApp(home: FollowsScreen()),
      ),
    );
    await tester.pump();

    expect(find.text('No pending requests'), findsOneWidget);
  });
}

class _LoadedEmptyFollowsNotifier extends FollowsNotifier {
  _LoadedEmptyFollowsNotifier()
      : super(
          FollowsRepository(apiClient: ApiClient(secureStorage: SecureStorage())),
        ) {
    state = const FollowsLoaded([]);
  }

  @override
  Future<void> loadPending() async {}
}
