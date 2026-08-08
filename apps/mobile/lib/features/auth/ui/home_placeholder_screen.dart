import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/gradient_header.dart';
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
      body: Column(
        children: [
          GradientHeader(
            title: 'Hi, ${widget.username}',
            subtitle: 'Welcome back',
            actions: [
              GradientHeaderAction(
                icon: Icons.logout,
                onPressed: () => ref.read(authNotifierProvider.notifier).logout(),
              ),
            ],
          ),
          const ActiveSosBanner(),
          const SharingIndicator(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const Center(child: SosButton()),
                const SizedBox(height: 28),
                _NavCard(
                  icon: Icons.group,
                  title: 'Circles',
                  subtitle: 'See who you share with',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CirclesListScreen()),
                  ),
                ),
                const SizedBox(height: 12),
                _NavCard(
                  icon: Icons.person_add_alt,
                  title: 'Follows',
                  subtitle: 'Manage follow requests',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const FollowsScreen()),
                  ),
                ),
                const SizedBox(height: 12),
                _NavCard(
                  icon: Icons.contact_phone,
                  title: 'Emergency Contacts',
                  subtitle: 'Who gets notified on SOS',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const EmergencyContactsScreen()),
                  ),
                ),
                const SizedBox(height: 12),
                _NavCard(
                  icon: Icons.person,
                  title: 'Profile',
                  subtitle: 'Sharing settings & privacy',
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const ProfileScreen()),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: colorScheme.primaryContainer,
                child: Icon(icon, color: colorScheme.onPrimaryContainer),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      subtitle,
                      style: TextStyle(color: colorScheme.onSurfaceVariant, fontSize: 13),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colorScheme.outline),
            ],
          ),
        ),
      ),
    );
  }
}
