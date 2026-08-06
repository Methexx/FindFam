import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../data/location_cache.dart';
import '../data/locations_repository.dart';
import '../domain/member_location.dart';
import 'ws_connection_notifier.dart';

sealed class CircleMapState {
  const CircleMapState();
}

class CircleMapInitial extends CircleMapState {
  const CircleMapInitial();
}

class CircleMapLoaded extends CircleMapState {
  const CircleMapLoaded(this.locationsByUserId, {this.isReconciling = false});
  final Map<String, MemberLocation> locationsByUserId;
  final bool isReconciling;
}

class CircleMapError extends CircleMapState {
  const CircleMapError(this.message);
  final String message;
}

final locationsRepositoryProvider = Provider<LocationsRepository>((ref) {
  return LocationsRepository(apiClient: ref.read(apiClientProvider));
});

final circleMapNotifierProvider =
    StateNotifierProvider.family<CircleMapNotifier, CircleMapState, String>((ref, circleId) {
  final notifier = CircleMapNotifier(
    ref.read(locationsRepositoryProvider),
    ref.read(wsClientProvider),
    circleId,
  );
  ref.onDispose(notifier.dispose);
  return notifier;
});

/// Per-circle live map state: combines the initial REST fetch with the
/// ongoing WS `location:broadcast` stream (filtered to this circle),
/// producing the live set of member positions. Updates are applied
/// in-place — a single broadcast never triggers a full re-fetch/re-render
/// of the whole map, per docs/05-realtime-channels.md's client-behavior note.
class CircleMapNotifier extends StateNotifier<CircleMapState> {
  CircleMapNotifier(this._repository, this._wsClient, this._circleId)
      : super(const CircleMapInitial()) {
    _seedFromCache();
    _messagesSubscription = _wsClient.messages.listen(_onWsMessage);
  }

  final LocationsRepository _repository;
  final WsClient _wsClient;
  final String _circleId;
  StreamSubscription<Map<String, dynamic>>? _messagesSubscription;

  void _seedFromCache() {
    final cached = LocationCache.instance.read(_circleId);
    if (cached.isNotEmpty) {
      state = CircleMapLoaded({for (final l in cached) l.userId: l});
    }
  }

  Future<void> load() async {
    try {
      final locations = await _repository.getLatestForCircle(_circleId);
      LocationCache.instance.writeAll(_circleId, locations);
      state = CircleMapLoaded({for (final l in locations) l.userId: l});
    } catch (e) {
      state = CircleMapError(e.toString());
    }
  }

  /// Re-fetches latest state — called after a WS reconnect to reconcile
  /// any broadcasts missed while disconnected.
  Future<void> reconcile() async {
    final current = state;
    if (current is CircleMapLoaded) {
      state = CircleMapLoaded(current.locationsByUserId, isReconciling: true);
    }
    await load();
  }

  void _onWsMessage(Map<String, dynamic> message) {
    if (message['type'] != 'location:broadcast') return;
    final payload = message['payload'] as Map<String, dynamic>?;
    if (payload == null || payload['circleId'] != _circleId) return;

    final location = MemberLocation.fromJson(payload);
    LocationCache.instance.writeOne(_circleId, location);

    final current = state;
    final updated = current is CircleMapLoaded
        ? Map<String, MemberLocation>.from(current.locationsByUserId)
        : <String, MemberLocation>{};
    updated[location.userId] = location;
    state = CircleMapLoaded(updated);
  }

  @override
  void dispose() {
    _messagesSubscription?.cancel();
    super.dispose();
  }
}
