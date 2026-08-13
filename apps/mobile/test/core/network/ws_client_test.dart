import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/network/ws_client.dart';
import 'package:mobile/core/storage/secure_storage.dart';
import 'package:web_socket_channel/io.dart';

class _FakeSecureStorage extends SecureStorage {
  @override
  Future<String?> readAccessToken() async => 'fake-access-token';
}

/// A minimal local WebSocket server so the reconnect logic can be exercised
/// against a real socket lifecycle (connect → auth → forced close →
/// reconnect) without touching the network.
class _TestWsServer {
  late HttpServer _httpServer;
  final _connections = <WebSocket>[];
  int connectionCount = 0;

  Future<void> start() async {
    _httpServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _httpServer.listen((request) async {
      final socket = await WebSocketTransformer.upgrade(request);
      connectionCount++;
      _connections.add(socket);
      socket.listen((raw) {
        final message = jsonDecode(raw as String) as Map<String, dynamic>;
        if (message['type'] == 'auth') {
          socket.add(jsonEncode({'type': 'auth:ok'}));
        }
      });
    });
  }

  int get port => _httpServer.port;

  /// Forcibly drops the most recent connection, simulating a dropped
  /// WebSocket (airplane mode, tunnel reset, etc.).
  Future<void> dropLatestConnection() async {
    if (_connections.isEmpty) return;
    await _connections.removeLast().close();
  }

  Future<void> stop() async {
    for (final socket in _connections) {
      await socket.close();
    }
    await _httpServer.close(force: true);
  }
}

void main() {
  late _TestWsServer server;

  setUp(() async {
    server = _TestWsServer();
    await server.start();
  });

  tearDown(() async {
    await server.stop();
  });

  test('connects, authenticates, and reaches connected status', () async {
    final client = WsClient(
      secureStorage: _FakeSecureStorage(),
      channelFactory: (_) =>
          IOWebSocketChannel.connect(Uri.parse('ws://127.0.0.1:${server.port}/ws')),
    );
    addTearDown(client.dispose);

    final statusFuture = client.connectionStatus.firstWhere(
      (s) => s == WsConnectionStatus.connected,
    );
    await client.connect();
    await statusFuture.timeout(const Duration(seconds: 5));

    expect(client.status, WsConnectionStatus.connected);
    expect(server.connectionCount, 1);
  });

  test('reconnects with backoff after the connection drops, and calls onReconnected', () async {
    final client = WsClient(
      secureStorage: _FakeSecureStorage(),
      channelFactory: (_) =>
          IOWebSocketChannel.connect(Uri.parse('ws://127.0.0.1:${server.port}/ws')),
    );
    addTearDown(client.dispose);

    var reconnectedCalls = 0;
    client.addReconnectedListener(() => reconnectedCalls++);

    final firstConnected = client.connectionStatus.firstWhere(
      (s) => s == WsConnectionStatus.connected,
    );
    await client.connect();
    await firstConnected.timeout(const Duration(seconds: 5));
    expect(reconnectedCalls, 1);

    // Track the disconnected -> connecting -> connected sequence that proves
    // the client noticed the drop and retried on its own, without any
    // manual intervention from the test.
    final disconnected = client.connectionStatus.firstWhere(
      (s) => s == WsConnectionStatus.disconnected,
    );
    await server.dropLatestConnection();
    await disconnected.timeout(const Duration(seconds: 5));

    final reconnected = client.connectionStatus.firstWhere(
      (s) => s == WsConnectionStatus.connected,
    );
    // Backoff starts at 1s — allow generous headroom above that floor
    // without asserting an exact delay (real timers, not fake_async, since
    // this exercises a real socket).
    await reconnected.timeout(const Duration(seconds: 10));

    expect(client.status, WsConnectionStatus.connected);
    expect(server.connectionCount, 2);
    expect(reconnectedCalls, 2);
  });

  test('does not reconnect after an explicit disconnect() call', () async {
    final client = WsClient(
      secureStorage: _FakeSecureStorage(),
      channelFactory: (_) =>
          IOWebSocketChannel.connect(Uri.parse('ws://127.0.0.1:${server.port}/ws')),
    );
    addTearDown(client.dispose);

    final firstConnected = client.connectionStatus.firstWhere(
      (s) => s == WsConnectionStatus.connected,
    );
    await client.connect();
    await firstConnected.timeout(const Duration(seconds: 5));

    client.disconnect();
    await Future<void>.delayed(const Duration(seconds: 3));

    expect(client.status, WsConnectionStatus.disconnected);
    expect(server.connectionCount, 1);
  });
}
