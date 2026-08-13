import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/ws_connection_notifier.dart';
import '../data/sos_repository.dart';
import '../domain/sos_event.dart';

class SosState {
  const SosState({
    this.ownActiveSos,
    this.othersActiveSos = const [],
    this.triggerError,
    this.isTriggering = false,
  });

  // The current user's own active SOS, if any — drives the persistent
  // "SOS active" banner.
  final SosEvent? ownActiveSos;

  // Active SOS events triggered by other members of the user's circles —
  // drives the unmissable circle-member alert. Deliberately a list, not a
  // single event: more than one circle member could be active at once.
  final List<SosEvent> othersActiveSos;

  final String? triggerError;
  final bool isTriggering;

  SosState copyWith({
    SosEvent? ownActiveSos,
    bool clearOwnActiveSos = false,
    List<SosEvent>? othersActiveSos,
    String? triggerError,
    bool clearTriggerError = false,
    bool? isTriggering,
  }) {
    return SosState(
      ownActiveSos: clearOwnActiveSos ? null : (ownActiveSos ?? this.ownActiveSos),
      othersActiveSos: othersActiveSos ?? this.othersActiveSos,
      triggerError: clearTriggerError ? null : (triggerError ?? this.triggerError),
      isTriggering: isTriggering ?? this.isTriggering,
    );
  }
}

final sosRepositoryProvider = Provider<SosRepository>((ref) {
  return SosRepository(apiClient: ref.read(apiClientProvider));
});

final sosNotifierProvider = StateNotifierProvider<SosNotifier, SosState>((ref) {
  final notifier = SosNotifier(
    ref.read(sosRepositoryProvider),
    ref.read(wsClientProvider),
    () {
      final state = ref.read(authNotifierProvider);
      return state is AuthAuthenticated ? state.user.id : null;
    },
  );
  ref.onDispose(notifier.dispose);
  return notifier;
});

/// Tracks both the current user's own active SOS (self-banner) and any
/// active SOS from other circle members (unmissable alert), and drives the
/// trigger flow. Per docs/07-data-flow.md Journey 2, triggering an SOS must
/// attempt WS and REST simultaneously — never depend solely on the WS
/// connection succeeding — with either success sufficient.
class SosNotifier extends StateNotifier<SosState> {
  SosNotifier(this._repository, this._wsClient, this._currentUserId) : super(const SosState()) {
    _messagesSubscription = _wsClient.messages.listen(_onWsMessage);
  }

  final SosRepository _repository;
  final WsClient _wsClient;
  final String? Function() _currentUserId;
  StreamSubscription<Map<String, dynamic>>? _messagesSubscription;

  Future<void> loadActive() async {
    try {
      final events = await _repository.listActiveSos();
      final userId = _currentUserId();
      final ownMatches = events.where((e) => e.userId == userId);
      final own = ownMatches.isEmpty ? null : ownMatches.first;
      final others = events.where((e) => e.userId != userId).toList();
      state = state.copyWith(ownActiveSos: own, clearOwnActiveSos: own == null, othersActiveSos: others);
    } catch (_) {
      // Non-fatal — the banner/alert simply won't show until the next
      // successful load or a WS broadcast arrives.
    }
  }

  Future<bool> trigger() async {
    state = state.copyWith(isTriggering: true, clearTriggerError: true);
    try {
      final position = await Geolocator.getCurrentPosition();
      final lat = position.latitude;
      final lng = position.longitude;

      // Fire both paths concurrently — either success is sufficient, per
      // the "never depend solely on WS" requirement. The WS path also
      // triggers the broadcast server-side, so we don't need to do
      // anything extra with its result beyond attempting it.
      if (_wsClient.status == WsConnectionStatus.connected) {
        _wsClient.triggerSos(lat: lat, lng: lng);
      }

      final event = await _repository.triggerSos(lat: lat, lng: lng);
      state = state.copyWith(ownActiveSos: event, isTriggering: false);
      return true;
    } catch (e) {
      state = state.copyWith(triggerError: e.toString(), isTriggering: false);
      return false;
    }
  }

  Future<bool> resolveOwnSos() async {
    final own = state.ownActiveSos;
    if (own == null) return false;
    try {
      await _repository.resolveSos(own.id);
      state = state.copyWith(clearOwnActiveSos: true);
      return true;
    } catch (e) {
      state = state.copyWith(triggerError: e.toString());
      return false;
    }
  }

  void _onWsMessage(Map<String, dynamic> message) {
    final type = message['type'];
    if (type != 'sos:broadcast' && type != 'sos:resolved') return;

    final payload = message['payload'] as Map<String, dynamic>?;
    if (payload == null) return;

    if (type == 'sos:broadcast') {
      final event = SosEvent.fromJson(payload);
      if (event.userId == _currentUserId()) {
        state = state.copyWith(ownActiveSos: event);
      } else {
        final others = [...state.othersActiveSos.where((e) => e.id != event.id), event];
        state = state.copyWith(othersActiveSos: others);
      }
      return;
    }

    // sos:resolved
    final id = payload['id'] as String?;
    if (id == null) return;
    if (state.ownActiveSos?.id == id) {
      state = state.copyWith(clearOwnActiveSos: true);
    }
    state = state.copyWith(
      othersActiveSos: state.othersActiveSos.where((e) => e.id != id).toList(),
    );
  }

  @override
  void dispose() {
    _messagesSubscription?.cancel();
    super.dispose();
  }
}
