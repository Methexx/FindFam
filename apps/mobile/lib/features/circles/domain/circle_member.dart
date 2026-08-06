class CircleMember {
  const CircleMember({
    required this.circleId,
    required this.userId,
    required this.username,
    required this.role,
    required this.joinedAt,
  });

  factory CircleMember.fromJson(Map<String, dynamic> json) {
    return CircleMember(
      circleId: json['circleId'] as String,
      userId: json['userId'] as String,
      username: json['username'] as String,
      role: json['role'] as String,
      joinedAt: json['joinedAt'] as String,
    );
  }

  final String circleId;
  final String userId;
  final String username;
  final String role;
  final String joinedAt;

  bool get isOwner => role == 'owner';
}
