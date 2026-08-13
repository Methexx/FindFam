import 'dart:async';
import 'dart:io';

import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';

class LocationUpdateEvent {
  const LocationUpdateEvent({
    required this.lat,
    required this.lng,
    required this.speed,
    required this.batteryLevel,
  });

  final double lat;
  final double lng;
  final double? speed;
  final int? batteryLevel;
}

/// Background location capture. Uses geolocator's balanced-power accuracy
/// setting with a foreground service on Android (required for Android 10+
/// to keep receiving updates while backgrounded, and doubles as the
/// persistent "you are sharing" indicator required by the product's
/// privacy-first positioning). Motion-adaptive sampling is deferred — see
/// motion_detector.dart.
class LocationService {
  LocationService({Battery? battery}) : _battery = battery ?? Battery();

  final Battery _battery;
  StreamSubscription<Position>? _positionSubscription;
  final _updatesController = StreamController<LocationUpdateEvent>.broadcast();

  Stream<LocationUpdateEvent> get updates => _updatesController.stream;

  /// Requests the permissions needed for background sharing. Returns false
  /// if the user denies (including permanently, on Android) — callers
  /// should show the pre-permission explanation screen *before* calling
  /// this, not after a denial.
  Future<bool> requestPermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    // "Always" / background permission is a separate, second-stage prompt
    // on both platforms — requested only after foreground access is
    // already granted, per docs/08-flutter-app-structure.md.
    if (permission == LocationPermission.whileInUse) {
      permission = await Geolocator.requestPermission();
    }

    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  Future<bool> isServiceEnabled() => Geolocator.isLocationServiceEnabled();

  /// Non-prompting check, unlike [requestPermission] — used to decide
  /// whether to resume capture on app start without surprising the user
  /// with a permission dialog they haven't triggered.
  Future<bool> hasPermission() async {
    final permission = await Geolocator.checkPermission();
    return permission == LocationPermission.always ||
        permission == LocationPermission.whileInUse;
  }

  void start() {
    if (_positionSubscription != null) return;

    final settings = Platform.isAndroid
        ? AndroidSettings(
            accuracy: LocationAccuracy.medium,
            distanceFilter: 20,
            intervalDuration: const Duration(seconds: 10),
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationTitle: 'FindFam is sharing your location',
              notificationText: 'Tap to open the app',
              enableWakeLock: true,
            ),
          )
        : AppleSettings(
            accuracy: LocationAccuracy.medium,
            distanceFilter: 20,
            activityType: ActivityType.other,
            pauseLocationUpdatesAutomatically: false,
            showBackgroundLocationIndicator: true,
          );

    _positionSubscription =
        Geolocator.getPositionStream(locationSettings: settings).listen(_onPosition);
  }

  Future<void> _onPosition(Position position) async {
    int? batteryLevel;
    try {
      batteryLevel = await _battery.batteryLevel;
    } catch (_) {
      batteryLevel = null;
    }

    _updatesController.add(
      LocationUpdateEvent(
        lat: position.latitude,
        lng: position.longitude,
        speed: position.speed,
        batteryLevel: batteryLevel,
      ),
    );
  }

  void stop() {
    _positionSubscription?.cancel();
    _positionSubscription = null;
  }

  void dispose() {
    stop();
    _updatesController.close();
  }
}
