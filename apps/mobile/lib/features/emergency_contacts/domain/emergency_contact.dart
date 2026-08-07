class EmergencyContact {
  const EmergencyContact({
    required this.id,
    required this.userId,
    required this.contactUserId,
    required this.username,
    required this.phone,
    required this.priority,
  });

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      id: json['id'] as String,
      userId: json['userId'] as String,
      contactUserId: json['contactUserId'] as String,
      username: json['username'] as String,
      phone: json['phone'] as String?,
      priority: json['priority'] as int,
    );
  }

  final String id;
  final String userId;
  final String contactUserId;
  final String username;
  final String? phone;
  final int priority;
}
