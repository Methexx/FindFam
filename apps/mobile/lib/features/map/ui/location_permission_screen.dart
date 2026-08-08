import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/widgets/app_error_text.dart';
import '../viewmodel/location_sharing_notifier.dart';

/// Shown before the system location-permission prompt fires. Explaining
/// why FindFam needs background location first — rather than firing the
/// system dialog cold — measurably improves grant rates and matches App
/// Store review expectations for apps requesting background location
/// (see docs/08-flutter-app-structure.md).
class LocationPermissionScreen extends ConsumerStatefulWidget {
  const LocationPermissionScreen({super.key});

  @override
  ConsumerState<LocationPermissionScreen> createState() => _LocationPermissionScreenState();
}

class _LocationPermissionScreenState extends ConsumerState<LocationPermissionScreen> {
  bool _requesting = false;
  bool _denied = false;

  Future<void> _onEnableSharing() async {
    setState(() => _requesting = true);
    final granted = await ref.read(locationSharingNotifierProvider.notifier).enableSharing();
    if (!mounted) return;
    setState(() {
      _requesting = false;
      _denied = !granted;
    });
    if (granted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Share your location')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.people_outline, size: 64, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 24),
            const Text(
              'FindFam shows your location to the circles you choose to join — '
              'and only while you\'re sharing.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            const SizedBox(height: 12),
            Text(
              'You\'ll see a persistent notification whenever sharing is active, '
              'and you can turn it off at any time.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 32),
            if (_denied)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Center(
                  child: AppErrorText(
                    'Location permission was denied. You can enable it in system settings.',
                  ),
                ),
              ),
            FilledButton(
              onPressed: _requesting ? null : _onEnableSharing,
              child: _requesting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Enable location sharing'),
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Not now'),
            ),
          ],
        ),
      ),
    );
  }
}
