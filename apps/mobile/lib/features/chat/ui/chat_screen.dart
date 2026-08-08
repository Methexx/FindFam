import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../viewmodel/chat_notifier.dart';

class ChatScreen extends ConsumerStatefulWidget {
  const ChatScreen({super.key, required this.circleId, required this.circleName});

  final String circleId;
  final String circleName;

  @override
  ConsumerState<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends ConsumerState<ChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(chatNotifierProvider(widget.circleId).notifier).load());
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      ref.read(chatNotifierProvider(widget.circleId).notifier).loadMore();
    }
  }

  Future<void> _send() async {
    final content = _inputController.text.trim();
    if (content.isEmpty) return;
    _inputController.clear();
    await ref.read(chatNotifierProvider(widget.circleId).notifier).sendMessage(content);
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(chatNotifierProvider(widget.circleId));
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : null;

    return Scaffold(
      appBar: AppBar(title: Text(widget.circleName)),
      body: Column(
        children: [
          Expanded(child: _buildMessageList(state, currentUserId)),
          _buildComposer(state),
        ],
      ),
    );
  }

  Widget _buildMessageList(ChatState state, String? currentUserId) {
    return switch (state) {
      ChatInitial() || ChatLoading() => const Center(child: CircularProgressIndicator()),
      ChatError(:final message) => Center(child: Text(message)),
      ChatLoaded(messages: final messages) => messages.isEmpty
          ? const AppEmptyState(
              icon: Icons.chat_bubble_outline,
              message: 'No messages yet — say hello',
            )
          : Builder(
              builder: (context) {
                final colorScheme = Theme.of(context).colorScheme;
                return ListView.builder(
                  controller: _scrollController,
                  reverse: true,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  itemCount: messages.length,
                  itemBuilder: (context, index) {
                    final message = messages[index];
                    final isSelf = message.senderId == currentUserId;
                    return Align(
                      alignment: isSelf ? Alignment.centerRight : Alignment.centerLeft,
                      child: Container(
                        margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: isSelf ? colorScheme.primary : colorScheme.surfaceContainerHigh,
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: Text(
                          message.content,
                          style: TextStyle(
                            color: isSelf ? colorScheme.onPrimary : colorScheme.onSurface,
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
    };
  }

  Widget _buildComposer(ChatState state) {
    final sendError = state is ChatLoaded ? state.sendError : null;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          children: [
            if (sendError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text(
                  sendError,
                  style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 12),
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _inputController,
                    decoration: const InputDecoration(hintText: 'Message'),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                IconButton(icon: const Icon(Icons.send), onPressed: _send),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
