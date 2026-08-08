import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/app_error_text.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/location_sharing_notifier.dart';
import '../../settings/ui/privacy_policy_screen.dart';
import '../viewmodel/profile_notifier.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final username = authState is AuthAuthenticated ? authState.user.username : '';
    final sharingState = ref.watch(locationSharingNotifierProvider);
    final profileState = ref.watch(profileNotifierProvider);

    final colorScheme = Theme.of(context).colorScheme;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              leading: CircleAvatar(
                radius: 24,
                backgroundColor: colorScheme.primaryContainer,
                child: Text(
                  username.isNotEmpty ? username.substring(0, 1).toUpperCase() : '?',
                  style: TextStyle(color: colorScheme.onPrimaryContainer),
                ),
              ),
              title: Text(username),
              subtitle: const Text('Logged in'),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: SwitchListTile(
              title: const Text('Share my location'),
              subtitle: const Text(
                'When off, circle members and emergency contacts cannot see your location',
              ),
              value: sharingState == LocationSharingState.on,
              onChanged: profileState.isUpdating
                  ? null
                  : (value) => ref.read(profileNotifierProvider.notifier).setSharing(value),
            ),
          ),
          if (profileState.error != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 12, 4, 0),
              child: AppErrorText(profileState.error!),
            ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              title: const Text('Privacy Policy'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
