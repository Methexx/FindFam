class MemberLocation {
  const MemberLocation({
    required this.userId,
    required this.lat,
    required this.lng,
    required this.speed,
    required this.batteryLevel,
    required this.recordedAt,
    this.username,
  });

  factory MemberLocation.fromJson(Map<String, dynamic> json) {
    return MemberLocation(
      userId: json['userId'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      batteryLevel: json['batteryLevel'] as int?,
      recordedAt: json['recordedAt'] as String,
      // Not sent by the backend yet — see docs/09-sprint-timeline.md Sprint 8.
      // Parsed defensively so this starts working the moment it is, with no
      // client-side change required.
      username: json['username'] as String?,
    );
  }

  final String userId;
  final double lat;
  final double lng;
  final double? speed;
  final int? batteryLevel;
  final String recordedAt;
  final String? username;

  DateTime get recordedAtLocal => DateTime.parse(recordedAt).toLocal();

  /// A pin has gone stale once it's old enough that showing it as "live"
  /// would be misleading — sharing paused, the device lost signal, or the
  /// app was killed without a clean disconnect.
  bool get isStale => DateTime.now().difference(recordedAtLocal) > const Duration(minutes: 5);

  /// Until the backend sends a username, fall back to a short, honest label
  /// instead of splashing the full 36-character user id across the UI.
  String get displayName {
    final name = username;
    if (name != null && name.isNotEmpty) return name;
    return 'Member ${userId.length >= 4 ? userId.substring(0, 4) : userId}';
  }
}
