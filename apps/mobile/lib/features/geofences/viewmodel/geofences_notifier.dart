import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/ws_connection_notifier.dart';
import '../data/geofences_repository.dart';
import '../domain/geofence.dart';

sealed class GeofencesState {
  const GeofencesState();
}

class GeofencesInitial extends GeofencesState {
  const GeofencesInitial();
}

class GeofencesLoading extends GeofencesState {
  const GeofencesLoading();
}

class GeofencesLoaded extends GeofencesState {
  const GeofencesLoaded(this.geofences, {this.actionError, this.lastEnteredName});
  final List<Geofence> geofences;
  final String? actionError;
  final String? lastEnteredName;
}

class GeofencesError extends GeofencesState {
  const GeofencesError(this.message);
  final String message;
}

final geofencesRepositoryProvider = Provider<GeofencesRepository>((ref) {
  return GeofencesRepository(apiClient: ref.read(apiClientProvider));
});

final geofencesNotifierProvider =
    StateNotifierProvider.family<GeofencesNotifier, GeofencesState, String>((ref, circleId) {
  return GeofencesNotifier(
    ref.read(geofencesRepositoryProvider),
    ref.read(wsClientProvider),
    circleId,
  );
});

/// Live-alert layer sits on top of plain CRUD: geofence:event travels on the
/// same circle:{id}:location channel clients already subscribe to for
/// location:broadcast, so no separate WS subscription is needed — only a
/// type filter.
class GeofencesNotifier extends StateNotifier<GeofencesState> {
  GeofencesNotifier(this._repository, this._wsClient, this._circleId)
      : super(const GeofencesInitial()) {
    _messagesSubscription = _wsClient.messages.listen(_onWsMessage);
  }

  final GeofencesRepository _repository;
  final WsClient _wsClient;
  final String _circleId;
  late final StreamSubscription<Map<String, dynamic>> _messagesSubscription;

  Future<void> load() async {
    state = const GeofencesLoading();
    try {
      final geofences = await _repository.listGeofences(_circleId);
      state = GeofencesLoaded(geofences);
    } catch (e) {
      state = GeofencesError(e.toString());
    }
  }

  Future<bool> createGeofence({
    required String name,
    required double lat,
    required double lng,
    required int radiusMeters,
  }) async {
    try {
      await _repository.createGeofence(
        _circleId,
        name: name,
        lat: lat,
        lng: lng,
        radiusMeters: radiusMeters,
      );
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is GeofencesLoaded) {
        state = GeofencesLoaded(current.geofences, actionError: e.toString());
      }
      return false;
    }
  }

  Future<bool> deleteGeofence(String id) async {
    try {
      await _repository.deleteGeofence(id);
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is GeofencesLoaded) {
        state = GeofencesLoaded(current.geofences, actionError: e.toString());
      }
      return false;
    }
  }

  void _onWsMessage(Map<String, dynamic> message) {
    if (message['type'] != 'geofence:event') return;
    final payload = message['payload'] as Map<String, dynamic>?;
    if (payload == null || payload['circleId'] != _circleId) return;
    if (payload['event'] != 'enter') return;

    final current = state;
    if (current is GeofencesLoaded) {
      state = GeofencesLoaded(
        current.geofences,
        actionError: current.actionError,
        lastEnteredName: payload['geofenceName'] as String?,
      );
    }
  }

  @override
  void dispose() {
    _messagesSubscription.cancel();
    super.dispose();
  }
}
