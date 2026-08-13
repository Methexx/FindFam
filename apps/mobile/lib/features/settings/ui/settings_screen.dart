import 'package:flutter/material.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/map/map_tile_config.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import 'privacy_policy_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Card(
            child: ListTile(
              title: const Text('Privacy Policy'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
              ),
            ),
          ),
          const SizedBox(height: 12),
          const _OfflineMapsCard(),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout),
              title: const Text('Log out'),
              onTap: () => ref.read(authNotifierProvider.notifier).logout(),
            ),
          ),
        ],
      ),
    );
  }
}

class _OfflineMapsCard extends StatefulWidget {
  const _OfflineMapsCard();

  @override
  State<_OfflineMapsCard> createState() => _OfflineMapsCardState();
}

class _OfflineMapsCardState extends State<_OfflineMapsCard> {
  static const _store = FMTCStore(kMapCacheStoreName);
  late Future<({double size, int length, int hits, int misses})> _statsFuture;

  @override
  void initState() {
    super.initState();
    _statsFuture = _store.stats.all;
  }

  Future<void> _clear() async {
    await _store.manage.reset();
    setState(() => _statsFuture = _store.stats.all);
  }

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Offline Maps', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            FutureBuilder<({double size, int length, int hits, int misses})>(
              future: _statsFuture,
              builder: (context, snapshot) {
                final stats = snapshot.data;
                final label = stats == null
                    ? 'Calculating…'
                    : '${stats.length} tiles saved · ${(stats.size / 1024).toStringAsFixed(1)} MB';
                return Text(label, style: TextStyle(color: colorScheme.onSurfaceVariant));
              },
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                onPressed: _clear,
                child: const Text('Clear offline maps'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
