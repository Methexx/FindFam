import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/map/map_tile_config.dart';
import '../../../core/theme/app_colors.dart';
import 'download_area_button.dart';

enum _LocationStatus { checking, serviceDisabled, denied, granted }

/// The home screen's own live map — shows the signed-in user's current
/// position, independent of circle location *sharing* (that stays gated
/// behind LocationSharingNotifier; this is purely a local "where am I"
/// view, so it works even if the user has never turned sharing on).
class MyLocationMapView extends StatefulWidget {
  const MyLocationMapView({super.key});

  @override
  State<MyLocationMapView> createState() => _MyLocationMapViewState();
}

class _MyLocationMapViewState extends State<MyLocationMapView> {
  final _mapController = MapController();
  StreamSubscription<Position>? _positionSubscription;
  Position? _position;
  _LocationStatus _status = _LocationStatus.checking;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    setState(() => _status = _LocationStatus.checking);

    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) setState(() => _status = _LocationStatus.serviceDisabled);
      return;
    }

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) setState(() => _status = _LocationStatus.denied);
      return;
    }

    if (mounted) setState(() => _status = _LocationStatus.granted);
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 5),
    ).listen(_onPosition);
  }

  void _onPosition(Position position) {
    final isFirstFix = _position == null;
    setState(() => _position = position);
    if (isFirstFix) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _mapController.move(LatLng(position.latitude, position.longitude), 16);
      });
    }
  }

  void _recenter() {
    final position = _position;
    if (position == null) return;
    _mapController.move(LatLng(position.latitude, position.longitude), 16);
  }

  @override
  void dispose() {
    _positionSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (_status) {
      case _LocationStatus.checking:
        return const Center(child: CircularProgressIndicator());
      case _LocationStatus.serviceDisabled:
        return _LocationPrompt(
          message: 'Turn on location services to see yourself on the map.',
          buttonLabel: 'Try again',
          onPressed: _init,
        );
      case _LocationStatus.denied:
        return _LocationPrompt(
          message: 'FindFam needs location permission to show your position on the map.',
          buttonLabel: 'Enable location',
          onPressed: _init,
        );
      case _LocationStatus.granted:
        final position = _position;
        if (position == null) {
          return const Center(child: CircularProgressIndicator());
        }
        final point = LatLng(position.latitude, position.longitude);
        return Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(initialCenter: point, initialZoom: 16),
              children: [
                TileLayer(
                  urlTemplate: kMapTileUrlTemplate,
                  userAgentPackageName: kMapUserAgentPackageName,
                  retinaMode: RetinaMode.isHighDensity(context),
                  tileProvider: const FMTCStore(kMapCacheStoreName).getTileProvider(),
                ),
                MarkerLayer(
                  markers: [
                    Marker(point: point, width: 44, height: 44, child: const _MyLocationDot()),
                  ],
                ),
              ],
            ),
            Positioned(
              right: 12,
              bottom: 12,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DownloadAreaButton(mapController: _mapController, heroTag: 'downloadMyLocationArea'),
                  const SizedBox(height: 12),
                  FloatingActionButton.small(
                    heroTag: 'recenterMyLocation',
                    onPressed: _recenter,
                    child: const Icon(Icons.my_location),
                  ),
                ],
              ),
            ),
          ],
        );
    }
  }
}

class _MyLocationDot extends StatelessWidget {
  const _MyLocationDot();

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.selfMarker.withValues(alpha: 0.18),
      ),
      child: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.selfMarker,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 4,
              offset: const Offset(0, 1),
            ),
          ],
        ),
      ),
    );
  }
}

class _LocationPrompt extends StatelessWidget {
  const _LocationPrompt({required this.message, required this.buttonLabel, required this.onPressed});

  final String message;
  final String buttonLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.location_off_outlined, size: 48, color: colorScheme.outline),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colorScheme.onSurfaceVariant),
            ),
            const SizedBox(height: 16),
            FilledButton(onPressed: onPressed, child: Text(buttonLabel)),
          ],
        ),
      ),
    );
  }
}
