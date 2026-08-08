import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_text.dart';
import '../viewmodel/follows_notifier.dart';

class FollowsScreen extends ConsumerStatefulWidget {
  const FollowsScreen({super.key});

  @override
  ConsumerState<FollowsScreen> createState() => _FollowsScreenState();
}

class _FollowsScreenState extends ConsumerState<FollowsScreen> {
  final _usernameController = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(followsNotifierProvider.notifier).loadPending());
  }

  @override
  void dispose() {
    _usernameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(followsNotifierProvider);
    final notifier = ref.read(followsNotifierProvider.notifier);

    return Scaffold(
      appBar: AppBar(title: const Text('Follows')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _usernameController,
                    decoration: const InputDecoration(labelText: 'Username to follow'),
                  ),
                ),
                const SizedBox(width: 8),
                FilledButton(
                  onPressed: () async {
                    final username = _usernameController.text.trim();
                    if (username.isEmpty) return;
                    final success = await notifier.sendFollowRequest(username);
                    if (success) {
                      _usernameController.clear();
                    }
                  },
                  child: const Text('Follow'),
                ),
              ],
            ),
            const SizedBox(height: 24),
            const Text('Pending requests', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Expanded(child: _buildPendingList(state, notifier)),
          ],
        ),
      ),
    );
  }

  Widget _buildPendingList(FollowsState state, FollowsNotifier notifier) {
    return switch (state) {
      FollowsInitial() || FollowsLoading() => const Center(child: CircularProgressIndicator()),
      FollowsError(:final message) => Center(child: Text(message)),
      FollowsLoaded(pending: final pending, actionError: final actionError) => Column(
          children: [
            if (actionError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: AppErrorText(actionError),
              ),
            if (pending.isEmpty)
              const Expanded(
                child: AppEmptyState(
                  icon: Icons.person_add_alt_outlined,
                  message: 'No pending requests',
                ),
              )
            else
              Expanded(
                child: ListView.separated(
                  itemCount: pending.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, index) {
                    final follow = pending[index];
                    return Card(
                      child: ListTile(
                        title: Text('Request from ${follow.followerId}'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.check, color: Colors.green),
                              onPressed: () => notifier.respond(follow.id, accept: true),
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.close,
                                color: Theme.of(context).colorScheme.error,
                              ),
                              onPressed: () => notifier.respond(follow.id, accept: false),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
    };
  }
}
