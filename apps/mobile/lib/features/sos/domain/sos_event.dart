class SosOrigin {
  const SosOrigin({required this.lat, required this.lng});

  factory SosOrigin.fromJson(Map<String, dynamic> json) {
    return SosOrigin(
      lat: (json['lat'] as num).toDouble(),
      lng: (json['lng'] as num).toDouble(),
    );
  }

  final double lat;
  final double lng;
}

class SosEvent {
  const SosEvent({
    required this.id,
    required this.userId,
    required this.origin,
    required this.status,
    required this.triggeredAt,
    required this.resolvedAt,
  });

  factory SosEvent.fromJson(Map<String, dynamic> json) {
    return SosEvent(
      id: json['id'] as String,
      userId: json['userId'] as String,
      origin: SosOrigin.fromJson(json['origin'] as Map<String, dynamic>),
      status: json['status'] as String,
      triggeredAt: json['triggeredAt'] as String,
      resolvedAt: json['resolvedAt'] as String?,
    );
  }

  final String id;
  final String userId;
  final SosOrigin origin;
  final String status;
  final String triggeredAt;
  final String? resolvedAt;

  bool get isActive => status == 'active';
}
