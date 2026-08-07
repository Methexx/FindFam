import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/core/network/api_client.dart';
import 'package:mobile/core/network/ws_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:mobile/features/sos/data/sos_repository.dart';
import 'package:mobile/features/sos/domain/sos_event.dart';
import 'package:mobile/features/sos/ui/active_sos_banner.dart';
import 'package:mobile/features/sos/ui/sos_button.dart';
import 'package:mobile/features/sos/viewmodel/sos_notifier.dart';

void main() {
  testWidgets('tapping the SOS button, confirming, calls trigger()', (tester) async {
    final notifier = _RecordingSosNotifier();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sosNotifierProvider.overrideWith((ref) => notifier),
        ],
        child: const MaterialApp(home: Scaffold(body: SosButton())),
      ),
    );
    await tester.pump();

    await tester.tap(find.text('SOS'));
    await tester.pumpAndSettle();

    // Confirmation dialog is shown before anything fires.
    expect(notifier.triggerCallCount, 0);
    expect(find.text('Trigger SOS?'), findsOneWidget);

    await tester.tap(find.text('Send SOS'));
    await tester.pumpAndSettle();

    expect(notifier.triggerCallCount, 1);
  });

  testWidgets('ActiveSosBanner is hidden with no active SOS and shown once one exists', (tester) async {
    final notifier = _RecordingSosNotifier();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sosNotifierProvider.overrideWith((ref) => notifier),
        ],
        child: const MaterialApp(home: Scaffold(body: ActiveSosBanner())),
      ),
    );
    await tester.pump();

    expect(find.text('Your SOS is active — sharing your location'), findsNothing);

    notifier.state = notifier.state.copyWith(
      ownActiveSos: const SosEvent(
        id: 'sos-1',
        userId: 'user-1',
        origin: SosOrigin(lat: 1, lng: 2),
        status: 'active',
        triggeredAt: '2026-01-01T00:00:00.000Z',
        resolvedAt: null,
      ),
    );
    await tester.pump();

    expect(find.text('Your SOS is active — sharing your location'), findsOneWidget);
  });
}

/// A SosNotifier stand-in that records trigger() calls instead of hitting
/// geolocation/network/WS — mirrors the override pattern used by the
/// existing circles/map screen tests (a real repository/WsClient is passed
/// through the constructor but never actually exercised).
class _RecordingSosNotifier extends SosNotifier {
  _RecordingSosNotifier()
      : super(
          SosRepository(apiClient: ApiClient(secureStorage: SecureStorage())),
          WsClient(secureStorage: SecureStorage()),
          () => 'user-1',
        );

  int triggerCallCount = 0;

  @override
  Future<bool> trigger() async {
    triggerCallCount++;
    return true;
  }

  @override
  Future<void> loadActive() async {}
}
