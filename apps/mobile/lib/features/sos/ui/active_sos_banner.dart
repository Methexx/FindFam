import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../viewmodel/sos_notifier.dart';

/// Persistent banner shown while the current user's own SOS is active.
/// Intended to be mounted once near the app shell (e.g. wrapping the home
/// screen's body) so it survives navigation rather than being scoped to a
/// single screen.
class ActiveSosBanner extends ConsumerWidget {
  const ActiveSosBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sosNotifierProvider);
    final ownActiveSos = state.ownActiveSos;
    if (ownActiveSos == null || !ownActiveSos.isActive) {
      return const SizedBox.shrink();
    }

    return Material(
      color: AppColors.danger,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.white),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Your SOS is active — sharing your location',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
              TextButton(
                onPressed: () => ref.read(sosNotifierProvider.notifier).resolveOwnSos(),
                style: TextButton.styleFrom(foregroundColor: Colors.white),
                child: const Text("I'm safe"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
