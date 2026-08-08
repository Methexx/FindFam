import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../viewmodel/circles_notifier.dart';
import 'circle_detail_screen.dart';

class CirclesListScreen extends ConsumerStatefulWidget {
  const CirclesListScreen({super.key});

  @override
  ConsumerState<CirclesListScreen> createState() => _CirclesListScreenState();
}

class _CirclesListScreenState extends ConsumerState<CirclesListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(circlesNotifierProvider.notifier).load());
  }

  Future<void> _showCreateDialog() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create circle'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Circle name'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Create'),
          ),
        ],
      ),
    );

    if (name != null && name.isNotEmpty) {
      await ref.read(circlesNotifierProvider.notifier).createCircle(name);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(circlesNotifierProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Circles')),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateDialog,
        child: const Icon(Icons.add),
      ),
      body: switch (state) {
        CirclesInitial() || CirclesLoading() => const Center(child: CircularProgressIndicator()),
        CirclesError(:final message) => Center(child: Text(message)),
        CirclesLoaded(circles: final circles) => circles.isEmpty
            ? const AppEmptyState(
                icon: Icons.group_outlined,
                message: "You're not in any circles yet — create one or wait for an invite",
              )
            : ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: circles.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  final circle = circles[index];
                  return Card(
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                        child: Icon(
                          Icons.group,
                          color: Theme.of(context).colorScheme.onPrimaryContainer,
                        ),
                      ),
                      title: Text(circle.name),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => CircleDetailScreen(circleId: circle.id),
                        ),
                      ),
                    ),
                  );
                },
              ),
      },
    );
  }
}
