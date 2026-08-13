import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/gradient_header.dart';
import '../../circles/ui/circles_list_screen.dart';
import '../../circles/ui/follows_screen.dart';
import '../../emergency_contacts/ui/emergency_contacts_screen.dart';
import '../../map/ui/my_location_map_view.dart';
import '../../profile/ui/profile_screen.dart';
import '../../profile/ui/sharing_indicator.dart';
import '../../settings/ui/settings_screen.dart';
import '../../sos/ui/active_sos_banner.dart';
import '../../sos/ui/circle_sos_alert.dart';
import '../../sos/ui/sos_button.dart';
import '../../sos/viewmodel/sos_notifier.dart';

class HomePlaceholderScreen extends ConsumerStatefulWidget {
  const HomePlaceholderScreen({super.key, required this.username});

  final String username;

  @override
  ConsumerState<HomePlaceholderScreen> createState() => _HomePlaceholderScreenState();
}

class _HomePlaceholderScreenState extends ConsumerState<HomePlaceholderScreen> {
  final Set<String> _shownAlertIds = {};
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(sosNotifierProvider.notifier).loadActive());
  }

  Future<void> _onDestinationSelected(int index) async {
    if (index == 0) {
      setState(() => _selectedIndex = 0);
      return;
    }

    setState(() => _selectedIndex = index);
    final Widget screen = switch (index) {
      1 => const CirclesListScreen(),
      2 => const FollowsScreen(),
      _ => const EmergencyContactsScreen(),
    };
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
    if (mounted) setState(() => _selectedIndex = 0);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(sosNotifierProvider, (previous, next) {
      // Prune ids no longer active *before* checking for new ones — without
      // this, a resolved SOS that gets re-triggered would never show a
      // second alert, since its id would still be marked as shown from the
      // first time.
      _shownAlertIds.retainAll(next.othersActiveSos.map((e) => e.id));
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
            leading: GradientHeaderAction(
              icon: Icons.person,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              ),
            ),
            actions: [
              GradientHeaderAction(
                icon: Icons.settings,
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                ),
              ),
            ],
          ),
          const ActiveSosBanner(),
          const SharingIndicator(),
          Expanded(
            child: Stack(
              children: [
                const MyLocationMapView(),
                const Positioned(
                  left: 0,
                  right: 0,
                  bottom: 20,
                  child: Center(child: SosButton()),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Map',
          ),
          NavigationDestination(
            icon: Icon(Icons.group_outlined),
            selectedIcon: Icon(Icons.group),
            label: 'Circles',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_add_alt_outlined),
            selectedIcon: Icon(Icons.person_add_alt),
            label: 'Follows',
          ),
          NavigationDestination(
            icon: Icon(Icons.contact_phone_outlined),
            selectedIcon: Icon(Icons.contact_phone),
            label: 'Emergency',
          ),
        ],
      ),
    );
  }
}
