/// Shared display formatting for a [MemberLocation]'s speed/battery, used by
/// both the marker detail sheet and the member-list row so the two never
/// drift out of sync.
String formatSpeed(double? speedMetersPerSecond) {
  if (speedMetersPerSecond == null) return 'Speed unknown';
  return '${(speedMetersPerSecond * 3.6).toStringAsFixed(0)} km/h';
}

String formatBattery(int? batteryLevel) {
  if (batteryLevel == null) return 'Battery unknown';
  return '$batteryLevel% battery';
}
