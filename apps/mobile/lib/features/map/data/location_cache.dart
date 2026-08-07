import '../domain/member_location.dart';

/// In-process cache of the last-known location per circle, so the map has
/// something to show immediately on a cold navigation into a circle
/// (before the REST fetch resolves or the first WS broadcast arrives),
/// per docs/08-flutter-app-structure.md's offline-handling notes.
class LocationCache {
  LocationCache._();
  static final LocationCache instance = LocationCache._();

  final Map<String, Map<String, MemberLocation>> _byCircle = {};

  List<MemberLocation> read(String circleId) {
    return _byCircle[circleId]?.values.toList() ?? const [];
  }

  void writeAll(String circleId, List<MemberLocation> locations) {
    final byUser = _byCircle.putIfAbsent(circleId, () => {});
    for (final location in locations) {
      byUser[location.userId] = location;
    }
  }

  void writeOne(String circleId, MemberLocation location) {
    final byUser = _byCircle.putIfAbsent(circleId, () => {});
    byUser[location.userId] = location;
  }
}
