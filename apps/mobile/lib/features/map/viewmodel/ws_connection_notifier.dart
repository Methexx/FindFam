import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../../core/network/ws_client.dart';

export '../../../core/network/ws_client.dart' show WsClient, WsConnectionStatus;

/// App-wide singleton WS connection, per docs/08-flutter-app-structure.md's
/// WsConnectionProvider pattern — other features derive state from this
/// rather than opening their own connection.
final wsClientProvider = Provider<WsClient>((ref) {
  final client = WsClient(secureStorage: ref.read(secureStorageProvider));
  ref.onDispose(client.dispose);
  return client;
});

final wsConnectionStatusProvider = StreamProvider<WsConnectionStatus>((ref) {
  final client = ref.watch(wsClientProvider);
  return client.connectionStatus;
});
