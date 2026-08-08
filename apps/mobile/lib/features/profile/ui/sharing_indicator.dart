import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../map/viewmodel/location_sharing_notifier.dart';

/// Persistent "you are sharing" indicator, required from Tier 1 onward per
/// docs/08-flutter-app-structure.md and the product's consent-first
/// positioning — mounted at the app shell so it's visible regardless of
/// which screen is open, not scoped to the map screen alone.
class SharingIndicator extends ConsumerWidget {
  const SharingIndicator({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sharingState = ref.watch(locationSharingNotifierProvider);
    if (sharingState != LocationSharingState.on) {
      return const SizedBox.shrink();
    }

    final colorScheme = Theme.of(context).colorScheme;
    return Material(
      color: colorScheme.primaryContainer,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.share_location, size: 16, color: colorScheme.onPrimaryContainer),
              const SizedBox(width: 6),
              Text(
                'You are sharing your location',
                style: TextStyle(fontSize: 12, color: colorScheme.onPrimaryContainer),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
