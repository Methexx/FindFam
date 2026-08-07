class MemberLocation {
  const MemberLocation({
    required this.userId,
    required this.lat,
    required this.lng,
    required this.speed,
    required this.batteryLevel,
    required this.recordedAt,
  });

  factory MemberLocation.fromJson(Map<String, dynamic> json) {
    return MemberLocation(
      userId: json['userId'] as String,
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
      speed: (json['speed'] as num?)?.toDouble(),
      batteryLevel: json['batteryLevel'] as int?,
      recordedAt: json['recordedAt'] as String,
    );
  }

  final String userId;
  final double lat;
  final double lng;
  final double? speed;
  final int? batteryLevel;
  final String recordedAt;
}
