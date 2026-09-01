class User {
  const User({
    required this.id,
    required this.username,
    required this.displayName,
    required this.email,
    required this.phone,
    required this.avatarUrl,
    required this.isSharing,
    required this.createdAt,
    required this.updatedAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      username: json['username'] as String,
      displayName: json['displayName'] as String?,
      email: json['email'] as String,
      phone: json['phone'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      isSharing: json['isSharing'] as bool,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String?,
    );
  }

  final String id;
  final String username;
  /// Optional, falls back to username for display when unset.
  final String? displayName;
  final String email;
  final String? phone;
  final String? avatarUrl;
  final bool isSharing;
  final String createdAt;
  final String? updatedAt;

  /// The name to show, preferring displayName over the raw username —
  /// mirrors the same fallback rule used on the web profile page.
  String get name => displayName?.isNotEmpty == true ? displayName! : username;
}
