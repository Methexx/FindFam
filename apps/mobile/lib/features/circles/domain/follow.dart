class Follow {
  const Follow({
    required this.id,
    required this.followerId,
    this.followerUsername,
    required this.followeeId,
    required this.status,
    required this.createdAt,
  });

  factory Follow.fromJson(Map<String, dynamic> json) {
    return Follow(
      id: json['id'] as String,
      followerId: json['followerId'] as String,
      followerUsername: json['followerUsername'] as String?,
      followeeId: json['followeeId'] as String,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String followerId;
  final String? followerUsername;
  final String followeeId;
  final String status;
  final String createdAt;

  /// Until every caller of Follow.fromJson is guaranteed to come from the
  /// joined endpoints, fall back to a short, honest label rather than the
  /// full UUID — mirrors MemberLocation.displayName's fallback.
  String get followerDisplayName {
    final name = followerUsername;
    if (name != null && name.isNotEmpty) return name;
    return 'User ${followerId.substring(0, 4)}';
  }
}
