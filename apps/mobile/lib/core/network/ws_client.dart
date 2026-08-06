import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:web_socket_channel/web_socket_channel.dart';

import '../../config/env.dart';
import '../storage/secure_storage.dart';

enum WsConnectionStatus { disconnected, connecting, connected }

/// Manages the single app-wide WebSocket connection: connects, sends the
/// `auth` message on open, exposes a stream of parsed broadcast messages,
/// and reconnects with exponential backoff on drop.
///
/// Other features (e.g. the live map) derive state from [messages] and
/// [connectionStatus] rather than opening their own connection, per
/// docs/08-flutter-app-structure.md's WsConnectionProvider pattern.
class WsClient {
  WsClient({required SecureStorage secureStorage, WebSocketChannel Function(Uri)? channelFactory})
      : _secureStorage = secureStorage,
        _channelFactory = channelFactory ?? WebSocketChannel.connect;

  final SecureStorage _secureStorage;
  final WebSocketChannel Function(Uri) _channelFactory;

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _subscription;
  Timer? _reconnectTimer;
  int _reconnectAttempt = 0;
  bool _manuallyDisconnected = false;

  final _messagesController = StreamController<Map<String, dynamic>>.broadcast();
  final _statusController = StreamController<WsConnectionStatus>.broadcast();

  /// Parsed inbound messages (e.g. `location:broadcast`, `auth:ok`, `error`).
  Stream<Map<String, dynamic>> get messages => _messagesController.stream;

  Stream<WsConnectionStatus> get connectionStatus => _statusController.stream;

  WsConnectionStatus _status = WsConnectionStatus.disconnected;
  WsConnectionStatus get status => _status;

  /// Called after every successful (re)connection + auth, so callers can
  /// reconcile state that may have been missed while disconnected (e.g.
  /// re-fetch GET /circles/:id/locations/latest for visible circles).
  void Function()? onReconnected;

  static const _baseBackoff = Duration(seconds: 1);
  static const _maxBackoff = Duration(seconds: 30);

  Future<void> connect() async {
    _manuallyDisconnected = false;
    await _openConnection();
  }

  Future<void> _openConnection() async {
    _setStatus(WsConnectionStatus.connecting);

    final accessToken = await _secureStorage.readAccessToken();
    if (accessToken == null) {
      _setStatus(WsConnectionStatus.disconnected);
      return;
    }

    try {
      final channel = _channelFactory(Uri.parse('${Env.wsUrl}/ws'));
      _channel = channel;

      _subscription = channel.stream.listen(
        _onMessage,
        onError: (_) => _handleDisconnect(),
        onDone: _handleDisconnect,
        cancelOnError: true,
      );

      channel.sink.add(jsonEncode({'type': 'auth', 'token': accessToken}));
    } catch (_) {
      _handleDisconnect();
    }
  }

  void _onMessage(dynamic raw) {
    final Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(raw as String) as Map<String, dynamic>;
    } catch (_) {
      return;
    }

    if (decoded['type'] == 'auth:ok') {
      _reconnectAttempt = 0;
      _setStatus(WsConnectionStatus.connected);
      onReconnected?.call();
      return;
    }

    _messagesController.add(decoded);
  }

  void sendLocationUpdate({
    required double lat,
    required double lng,
    double? speed,
    int? batteryLevel,
  }) {
    if (_status != WsConnectionStatus.connected) return;
    _channel?.sink.add(
      jsonEncode({
        'type': 'location:update',
        'payload': {
          'lat': lat,
          'lng': lng,
          if (speed != null) 'speed': speed,
          if (batteryLevel != null) 'batteryLevel': batteryLevel,
        },
      }),
    );
  }

  void _handleDisconnect() {
    _subscription?.cancel();
    _subscription = null;
    _channel = null;

    if (_manuallyDisconnected) {
      _setStatus(WsConnectionStatus.disconnected);
      return;
    }

    _setStatus(WsConnectionStatus.disconnected);
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    final delayMs = min(
      _baseBackoff.inMilliseconds * pow(2, _reconnectAttempt).toInt(),
      _maxBackoff.inMilliseconds,
    );
    _reconnectAttempt++;
    _reconnectTimer = Timer(Duration(milliseconds: delayMs), () {
      if (_manuallyDisconnected) return;
      _openConnection();
    });
  }

  void disconnect() {
    _manuallyDisconnected = true;
    _reconnectTimer?.cancel();
    _subscription?.cancel();
    _channel?.sink.close();
    _channel = null;
    _setStatus(WsConnectionStatus.disconnected);
  }

  void _setStatus(WsConnectionStatus newStatus) {
    _status = newStatus;
    _statusController.add(newStatus);
  }

  void dispose() {
    disconnect();
    _messagesController.close();
    _statusController.close();
  }
}
