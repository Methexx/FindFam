import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../circles/ui/circles_list_screen.dart';
import '../../circles/ui/follows_screen.dart';
import '../../emergency_contacts/ui/emergency_contacts_screen.dart';
import '../../profile/ui/profile_screen.dart';
import '../../profile/ui/sharing_indicator.dart';
import '../../sos/ui/active_sos_banner.dart';
import '../../sos/ui/circle_sos_alert.dart';
import '../../sos/ui/sos_button.dart';
import '../../sos/viewmodel/sos_notifier.dart';
import '../viewmodel/auth_notifier.dart';

class HomePlaceholderScreen extends ConsumerStatefulWidget {
  const HomePlaceholderScreen({super.key, required this.username});

  final String username;

  @override
  ConsumerState<HomePlaceholderScreen> createState() => _HomePlaceholderScreenState();
}

class _HomePlaceholderScreenState extends ConsumerState<HomePlaceholderScreen> {
  final Set<String> _shownAlertIds = {};

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(sosNotifierProvider.notifier).loadActive());
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sosNotifierProvider, (previous, next) {
      for (final event in next.othersActiveSos) {
        if (_shownAlertIds.add(event.id)) {
          CircleSosAlert.maybeShow(context, ref, event);
        }
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('FindFam')),
      body: Column(
        children: [
          const ActiveSosBanner(),
          const SharingIndicator(),
          Expanded(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Logged in as ${widget.username}'),
                  const SizedBox(height: 24),
                  const SosButton(),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const CirclesListScreen()),
                    ),
                    child: const Text('Circles'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const FollowsScreen()),
                    ),
                    child: const Text('Follows'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const EmergencyContactsScreen()),
                    ),
                    child: const Text('Emergency Contacts'),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => const ProfileScreen()),
                    ),
                    child: const Text('Profile'),
                  ),
                  const SizedBox(height: 16),
                  OutlinedButton(
                    onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
                    child: const Text('Log out'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
