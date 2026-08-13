class Geofence {
  const Geofence({
    required this.id,
    required this.circleId,
    required this.name,
    required this.lat,
    required this.lng,
    required this.radiusMeters,
    required this.createdBy,
  });

  factory Geofence.fromJson(Map<String, dynamic> json) {
    final center = json['center'] as Map<String, dynamic>;
    return Geofence(
      id: json['id'] as String,
      circleId: json['circleId'] as String,
      name: json['name'] as String,
      lat: (center['lat'] as num).toDouble(),
      lng: (center['lng'] as num).toDouble(),
      radiusMeters: json['radiusMeters'] as int,
      createdBy: json['createdBy'] as String,
    );
  }

  final String id;
  final String circleId;
  final String name;
  final double lat;
  final double lng;
  final int radiusMeters;
  final String createdBy;
}
