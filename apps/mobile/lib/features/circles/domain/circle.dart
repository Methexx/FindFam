import 'circle_member.dart';

class Circle {
  const Circle({
    required this.id,
    required this.name,
    required this.ownerId,
    required this.createdAt,
    required this.deletedAt,
  });

  factory Circle.fromJson(Map<String, dynamic> json) {
    return Circle(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerId: json['ownerId'] as String,
      createdAt: json['createdAt'] as String,
      deletedAt: json['deletedAt'] as String?,
    );
  }

  final String id;
  final String name;
  final String ownerId;
  final String createdAt;
  final String? deletedAt;
}

class CircleWithMembers extends Circle {
  const CircleWithMembers({
    required super.id,
    required super.name,
    required super.ownerId,
    required super.createdAt,
    required super.deletedAt,
    required this.members,
  });

  factory CircleWithMembers.fromJson(Map<String, dynamic> json) {
    final membersJson = json['members'] as List<dynamic>;
    return CircleWithMembers(
      id: json['id'] as String,
      name: json['name'] as String,
      ownerId: json['ownerId'] as String,
      createdAt: json['createdAt'] as String,
      deletedAt: json['deletedAt'] as String?,
      members: membersJson
          .map((m) => CircleMember.fromJson(m as Map<String, dynamic>))
          .toList(),
    );
  }

  final List<CircleMember> members;
}
