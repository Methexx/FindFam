import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/map/data/locations_repository.dart';
import 'package:mobile/features/map/ui/circle_map_screen.dart';
import 'package:mobile/features/map/viewmodel/circle_map_notifier.dart';
import 'package:mobile/features/map/viewmodel/ws_connection_notifier.dart';

void main() {
  testWidgets('shows the empty state when no one has shared a location yet', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          circleMapNotifierProvider('circle-1').overrideWith(
            (ref) => _LoadedEmptyCircleMapNotifier(),
          ),
          wsConnectionStatusProvider.overrideWith(
            (ref) => Stream.value(WsConnectionStatus.connected),
          ),
        ],
        child: const MaterialApp(
          home: CircleMapScreen(circleId: 'circle-1', circleName: 'Family'),
        ),
      ),
    );
    await tester.pump();

    expect(
      find.text('No one in this circle has shared their location yet'),
      findsOneWidget,
    );
  });
}

class _LoadedEmptyCircleMapNotifier extends CircleMapNotifier {
  _LoadedEmptyCircleMapNotifier()
      : super(
          LocationsRepository(apiClient: ApiClient(secureStorage: SecureStorage())),
          WsClient(secureStorage: SecureStorage()),
          'circle-1',
        ) {
    state = const CircleMapLoaded({});
  }

  @override
  Future<void> load() async {}
}
