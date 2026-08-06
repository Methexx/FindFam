import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/location/location_service.dart';
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
  return LocationSharingNotifier(
    ref.read(locationServiceProvider),
    ref.read(wsClientProvider),
    ref.read(locationsRepositoryProvider),
  );
});

/// Wires captured positions to the outgoing side of the realtime layer:
/// sends over the open WS connection when available, and falls back to the
/// REST endpoint when it isn't — mirroring the ingest-side split so a
/// dropped WS connection never means a gap in location sharing.
class LocationSharingNotifier extends StateNotifier<LocationSharingState> {
  LocationSharingNotifier(this._locationService, this._wsClient, this._locationsRepository)
      : super(LocationSharingState.off) {
    _locationService.updates.listen(_onUpdate);
  }

  final LocationService _locationService;
  final WsClient _wsClient;
  final LocationsRepository _locationsRepository;

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

  void _onUpdate(LocationUpdateEvent event) {
    if (_wsClient.status == WsConnectionStatus.connected) {
      _wsClient.sendLocationUpdate(
        lat: event.lat,
        lng: event.lng,
        speed: event.speed,
        batteryLevel: event.batteryLevel,
      );
    } else {
      // REST fallback — fire-and-forget, matches SOS's "attempt both,
      // either success is sufficient" spirit for reliability, minus the
      // WS attempt since we already know it's down.
      _locationsRepository.postLocation(
        lat: event.lat,
        lng: event.lng,
        speed: event.speed,
        batteryLevel: event.batteryLevel,
      );
    }
  }
}
