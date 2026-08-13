import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/location/location_service.dart';
import '../../../core/network/exceptions.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../data/locations_repository.dart';
import 'circle_map_notifier.dart' show locationsRepositoryProvider;
import 'ws_connection_notifier.dart';

enum LocationSharingState { off, on }

final locationServiceProvider = Provider<LocationService>((ref) {
  final service = LocationService();
  ref.onDispose(service.dispose);
  return service;
});

final locationSharingNotifierProvider =
    StateNotifierProvider<LocationSharingNotifier, LocationSharingState>((ref) {
  final authState = ref.read(authNotifierProvider);
  final initial = authState is AuthAuthenticated && authState.user.isSharing
      ? LocationSharingState.on
      : LocationSharingState.off;
  return LocationSharingNotifier(
    ref.read(locationServiceProvider),
    ref.read(wsClientProvider),
    ref.read(locationsRepositoryProvider),
    initial: initial,
  );
});

/// Wires captured positions to the outgoing side of the realtime layer:
/// sends over the open WS connection when available, and falls back to the
/// REST endpoint when it isn't — mirroring the ingest-side split so a
/// dropped WS connection never means a gap in location sharing.
class LocationSharingNotifier extends StateNotifier<LocationSharingState> {
  LocationSharingNotifier(
    this._locationService,
    this._wsClient,
    this._locationsRepository, {
    LocationSharingState initial = LocationSharingState.off,
  }) : super(LocationSharingState.off) {
    _updatesSubscription = _locationService.updates.listen(_onUpdate);
    if (initial == LocationSharingState.on) {
      _resumeIfPermitted();
    }
  }

  // Server says sharing was on when the app last ran, but resuming capture
  // still needs the OS permission check first — silently starting without
  // it would throw, and re-prompting on every cold start would be worse
  // than the stale-toggle bug this is fixing.
  Future<void> _resumeIfPermitted() async {
    final permitted = await _locationService.hasPermission();
    if (!permitted) return;
    _locationService.start();
    state = LocationSharingState.on;
  }

  final LocationService _locationService;
  final WsClient _wsClient;
  final LocationsRepository _locationsRepository;
  late final StreamSubscription<LocationUpdateEvent> _updatesSubscription;

  Future<bool> enableSharing() async {
    final granted = await _locationService.requestPermission();
    if (!granted) return false;

    _locationService.start();
    state = LocationSharingState.on;
    return true;
  }

  void disableSharing() {
    _locationService.stop();
    state = LocationSharingState.off;
  }

  Future<void> _onUpdate(LocationUpdateEvent event) async {
    if (_wsClient.status == WsConnectionStatus.connected) {
      _wsClient.sendLocationUpdate(
        lat: event.lat,
        lng: event.lng,
        speed: event.speed,
        batteryLevel: event.batteryLevel,
      );
      return;
    }

    // REST fallback, matching SOS's "attempt both, either success is
    // sufficient" spirit for reliability, minus the WS attempt since we
    // already know it's down. Awaited and caught rather than fire-and-
    // forget — postLocation throws ApiException on failure, which an
    // un-awaited call would surface as an unhandled async error on every
    // single dropped update while offline.
    try {
      await _locationsRepository.postLocation(
        lat: event.lat,
        lng: event.lng,
        speed: event.speed,
        batteryLevel: event.batteryLevel,
      );
    } on ApiException {
      // Non-fatal — this sample is lost, but capture continues and the
      // next one (WS or REST) will carry the user's current position.
    }
  }

  @override
  void dispose() {
    _updatesSubscription.cancel();
    super.dispose();
  }
}
