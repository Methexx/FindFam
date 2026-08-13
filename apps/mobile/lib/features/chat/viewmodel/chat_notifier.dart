import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/ws_connection_notifier.dart';
import '../data/chat_repository.dart';
import '../domain/message.dart';

sealed class ChatState {
  const ChatState();
}

class ChatInitial extends ChatState {
  const ChatInitial();
}

class ChatLoading extends ChatState {
  const ChatLoading();
}

class ChatLoaded extends ChatState {
  const ChatLoaded(
    this.messages, {
    this.hasMore = true,
    this.isLoadingMore = false,
    this.sendError,
  });

  // Newest-first, matching the REST endpoint's ordering.
  final List<Message> messages;
  final bool hasMore;
  final bool isLoadingMore;
  final String? sendError;
}

class ChatError extends ChatState {
  const ChatError(this.message);
  final String message;
}

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  return ChatRepository(apiClient: ref.read(apiClientProvider));
});

final chatNotifierProvider =
    StateNotifierProvider.family<ChatNotifier, ChatState, String>((ref, circleId) {
  final notifier = ChatNotifier(
    ref.read(chatRepositoryProvider),
    ref.read(wsClientProvider),
    circleId,
  );
  ref.onDispose(notifier.dispose);
  return notifier;
});

/// Per-circle chat state: REST-fetched (paginated) history merged with the
/// live `message:broadcast` WS stream, per docs/08-flutter-app-structure.md's
/// ChatMessagesProvider pattern.
class ChatNotifier extends StateNotifier<ChatState> {
  ChatNotifier(this._repository, this._wsClient, this._circleId) : super(const ChatInitial()) {
    _messagesSubscription = _wsClient.messages.listen(_onWsMessage);
  }

  final ChatRepository _repository;
  final WsClient _wsClient;
  final String _circleId;
  StreamSubscription<Map<String, dynamic>>? _messagesSubscription;
  String? _nextCursor;

  Future<void> load() async {
    state = const ChatLoading();
    try {
      final page = await _repository.listMessages(_circleId);
      _nextCursor = page.nextCursor;
      state = ChatLoaded(page.messages, hasMore: page.nextCursor != null);
    } catch (e) {
      state = ChatError(e.toString());
    }
  }

  Future<void> loadMore() async {
    final current = state;
    if (current is! ChatLoaded || !current.hasMore || current.isLoadingMore) return;

    state = ChatLoaded(current.messages, hasMore: current.hasMore, isLoadingMore: true);
    try {
      final page = await _repository.listMessages(_circleId, cursor: _nextCursor);
      _nextCursor = page.nextCursor;

      // Re-read state rather than reusing the pre-await `current` — a
      // message:broadcast can prepend a new message to state while this
      // fetch is in flight, and overwriting with the stale capture would
      // silently drop it.
      final latest = state;
      final messagesSoFar = latest is ChatLoaded ? latest.messages : current.messages;
      state = ChatLoaded(
        [...messagesSoFar, ...page.messages],
        hasMore: page.nextCursor != null,
      );
    } catch (_) {
      final latest = state;
      final messagesSoFar = latest is ChatLoaded ? latest.messages : current.messages;
      state = ChatLoaded(messagesSoFar, hasMore: current.hasMore);
    }
  }

  /// Sends over WS (primary) with a REST retry if the WS send didn't land —
  /// unlike SOS, chat doesn't need an always-dual-send: a duplicate SOS is
  /// harmless (deduplicated server-side) but a duplicate chat message is a
  /// visible UX defect, so this only falls back, it doesn't always double-send.
  ///
  /// `sendLocationUpdate`-style fire-and-forget doesn't carry a delivery ack,
  /// so a connected-but-actually-dead socket (not yet detected by
  /// _handleDisconnect) would otherwise silently drop the message. Give the
  /// broadcast echo a short window to arrive via _onWsMessage before falling
  /// back to REST.
  Future<bool> sendMessage(String content) async {
    final current = state;
    try {
      if (_wsClient.status == WsConnectionStatus.connected) {
        final beforeIds = current is ChatLoaded
            ? current.messages.map((m) => m.id).toSet()
            : <String>{};
        _wsClient.sendMessage(circleId: _circleId, content: content);

        await Future<void>.delayed(const Duration(seconds: 3));
        final landed = state;
        final arrived = landed is ChatLoaded &&
            landed.messages.any((m) => m.content == content && !beforeIds.contains(m.id));
        if (!arrived) {
          await _repository.sendMessage(_circleId, content);
        }
      } else {
        await _repository.sendMessage(_circleId, content);
      }
      return true;
    } catch (e) {
      if (current is ChatLoaded) {
        state = ChatLoaded(
          current.messages,
          hasMore: current.hasMore,
          sendError: e.toString(),
        );
      }
      return false;
    }
  }

  void _onWsMessage(Map<String, dynamic> message) {
    if (message['type'] != 'message:broadcast') return;
    final payload = message['payload'] as Map<String, dynamic>?;
    if (payload == null || payload['circleId'] != _circleId) return;

    final incoming = Message.fromJson(payload);
    final current = state;
    final existing = current is ChatLoaded ? current.messages : <Message>[];
    if (existing.any((m) => m.id == incoming.id)) return;

    state = ChatLoaded(
      [incoming, ...existing],
      hasMore: current is ChatLoaded ? current.hasMore : true,
    );
  }

  @override
  void dispose() {
    _messagesSubscription?.cancel();
    super.dispose();
  }
}
