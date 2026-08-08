import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_colors.dart';
import '../domain/sos_event.dart';

/// Full-screen, hard-to-miss alert shown when a circle member's SOS goes
/// active. This is the entire point of the feature, so it deliberately
/// isn't a quiet list item — it takes over the screen until dismissed.
class CircleSosAlert extends ConsumerWidget {
  const CircleSosAlert({super.key, required this.event});

  final SosEvent event;

  static Future<void> maybeShow(BuildContext context, WidgetRef ref, SosEvent event) {
    return showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => CircleSosAlert(event: event),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Dialog.fullscreen(
      backgroundColor: AppColors.danger,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 96),
              const SizedBox(height: 24),
              const Text(
                'A circle member triggered an SOS',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Text(
                'Triggered at ${event.triggeredAt}',
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 32),
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.danger,
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Dismiss'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
