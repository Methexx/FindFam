import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../domain/circle.dart';
import '../viewmodel/circle_detail_notifier.dart';

class CircleDetailScreen extends ConsumerStatefulWidget {
  const CircleDetailScreen({super.key, required this.circleId});

  final String circleId;

  @override
  ConsumerState<CircleDetailScreen> createState() => _CircleDetailScreenState();
}

class _CircleDetailScreenState extends ConsumerState<CircleDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(circleDetailNotifierProvider(widget.circleId).notifier).load(),
    );
  }

  Future<void> _showAddMemberDialog() async {
    final controller = TextEditingController();
    final username = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add member'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Username'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (username != null && username.isNotEmpty) {
      await ref.read(circleDetailNotifierProvider(widget.circleId).notifier).addMember(username);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(circleDetailNotifierProvider(widget.circleId));
    final notifier = ref.read(circleDetailNotifierProvider(widget.circleId).notifier);
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : null;

    return Scaffold(
      appBar: AppBar(title: const Text('Circle')),
      body: switch (state) {
        CircleDetailInitial() || CircleDetailLoading() =>
          const Center(child: CircularProgressIndicator()),
        CircleDetailError(:final message) => Center(child: Text(message)),
        CircleDetailLoaded(circle: final circle, actionError: final actionError) => _buildLoaded(
            context,
            circle,
            currentUserId,
            notifier,
            actionError,
          ),
      },
    );
  }

  Widget _buildLoaded(
    BuildContext context,
    CircleWithMembers circle,
    String? currentUserId,
    CircleDetailNotifier notifier,
    String? actionError,
  ) {
    final isOwner = circle.members.any(
      (m) => m.userId == currentUserId && m.isOwner,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Text(circle.name, style: Theme.of(context).textTheme.headlineSmall),
        ),
        if (actionError != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(actionError, style: const TextStyle(color: Colors.red)),
          ),
        if (isOwner)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: OutlinedButton(
              onPressed: _showAddMemberDialog,
              child: const Text('Add member'),
            ),
          ),
        Expanded(
          child: ListView.builder(
            itemCount: circle.members.length,
            itemBuilder: (context, index) {
              final member = circle.members[index];
              final isSelf = member.userId == currentUserId;
              return ListTile(
                title: Text(member.username),
                subtitle: Text(member.role),
                trailing: (isOwner && !isSelf) || (isSelf && !member.isOwner)
                    ? IconButton(
                        icon: Icon(isSelf ? Icons.exit_to_app : Icons.remove_circle_outline),
                        onPressed: () => notifier.removeMember(member.userId),
                      )
                    : null,
              );
            },
          ),
        ),
        if (isOwner)
          Padding(
            padding: const EdgeInsets.all(16),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
              onPressed: () async {
                final deleted = await notifier.deleteCircle();
                if (deleted && context.mounted) {
                  Navigator.of(context).pop();
                }
              },
              child: const Text('Delete circle'),
            ),
          ),
      ],
    );
  }
}
