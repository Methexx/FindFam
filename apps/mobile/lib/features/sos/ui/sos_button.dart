import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../viewmodel/sos_notifier.dart';

/// The SOS trigger button — large and confirm-before-fire, since an
/// accidental tap sends a real alert to emergency contacts and circle
/// members. Not something to make it easy to fat-finger.
class SosButton extends ConsumerWidget {
  const SosButton({super.key});

  Future<void> _confirmAndTrigger(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Trigger SOS?'),
        content: const Text(
          'This immediately shares your location with your circles and emergency '
          'contacts. This is not a substitute for calling emergency services.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Send SOS'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await ref.read(sosNotifierProvider.notifier).trigger();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(sosNotifierProvider);

    return SizedBox(
      width: 120,
      height: 120,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: Colors.red,
          shape: const CircleBorder(),
        ),
        onPressed: state.isTriggering ? null : () => _confirmAndTrigger(context, ref),
        child: state.isTriggering
            ? const CircularProgressIndicator(color: Colors.white)
            : const Text('SOS', style: TextStyle(fontSize: 24, color: Colors.white)),
      ),
    );
  }
}
