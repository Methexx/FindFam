class Follow {
  const Follow({
    required this.id,
    required this.followerId,
    required this.followeeId,
    required this.status,
    required this.createdAt,
  });

  factory Follow.fromJson(Map<String, dynamic> json) {
    return Follow(
      id: json['id'] as String,
      followerId: json['followerId'] as String,
      followeeId: json['followeeId'] as String,
      status: json['status'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String followerId;
  final String followeeId;
  final String status;
  final String createdAt;
}
