import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/location_sharing_notifier.dart';
import '../viewmodel/profile_notifier.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authNotifierProvider);
    final username = authState is AuthAuthenticated ? authState.user.username : '';
    final sharingState = ref.watch(locationSharingNotifierProvider);
    final profileState = ref.watch(profileNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: ListView(
        children: [
          ListTile(title: Text(username), subtitle: const Text('Logged in')),
          const Divider(),
          SwitchListTile(
            title: const Text('Share my location'),
            subtitle: const Text(
              'When off, circle members and emergency contacts cannot see your location',
            ),
            value: sharingState == LocationSharingState.on,
            onChanged: profileState.isUpdating
                ? null
                : (value) => ref.read(profileNotifierProvider.notifier).setSharing(value),
          ),
          if (profileState.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(profileState.error!, style: const TextStyle(color: Colors.red)),
            ),
        ],
      ),
    );
  }
}
