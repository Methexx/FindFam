import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/circles/data/circles_repository.dart';
import 'package:mobile/features/circles/ui/circles_list_screen.dart';
import 'package:mobile/features/circles/viewmodel/circles_notifier.dart';

void main() {
  testWidgets('shows the empty state when the user has no circles', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          circlesNotifierProvider.overrideWith((ref) => _LoadedEmptyCirclesNotifier()),
        ],
        child: const MaterialAppWrapper(child: CirclesListScreen()),
      ),
    );
    await tester.pump();

    expect(
      find.text("You're not in any circles yet — create one or wait for an invite"),
      findsOneWidget,
    );
  });
}

class _LoadedEmptyCirclesNotifier extends CirclesNotifier {
  _LoadedEmptyCirclesNotifier()
      : super(
          CirclesRepository(apiClient: ApiClient(secureStorage: SecureStorage())),
        ) {
    state = const CirclesLoaded([]);
  }

  @override
  Future<void> load() async {}
}

class MaterialAppWrapper extends StatelessWidget {
  const MaterialAppWrapper({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => MaterialApp(home: child);
}
