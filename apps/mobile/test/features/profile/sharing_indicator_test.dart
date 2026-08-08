import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/features/map/viewmodel/location_sharing_notifier.dart';
import 'package:mobile/features/profile/ui/sharing_indicator.dart';

void main() {
  testWidgets('hidden when sharing is off', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          locationSharingNotifierProvider.overrideWith(
            (ref) => _FixedLocationSharingNotifier(LocationSharingState.off),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: SharingIndicator())),
      ),
    );
    await tester.pump();

    expect(find.text('You are sharing your location'), findsNothing);
  });

  testWidgets('shown when sharing is on', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          locationSharingNotifierProvider.overrideWith(
            (ref) => _FixedLocationSharingNotifier(LocationSharingState.on),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: SharingIndicator())),
      ),
    );
    await tester.pump();

    expect(find.text('You are sharing your location'), findsOneWidget);
  });
}

class _FixedLocationSharingNotifier extends StateNotifier<LocationSharingState>
    implements LocationSharingNotifier {
  _FixedLocationSharingNotifier(super.state);

  @override
  Future<bool> enableSharing() async => true;

  @override
  void disableSharing() {}
}
