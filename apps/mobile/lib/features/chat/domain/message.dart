class Message {
  const Message({
    required this.id,
    required this.circleId,
    required this.senderId,
    required this.content,
    required this.sentAt,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as String,
      circleId: json['circleId'] as String,
      senderId: json['senderId'] as String,
      content: json['content'] as String,
      sentAt: json['sentAt'] as String,
    );
  }

  final String id;
  final String circleId;
  final String senderId;
  final String content;
  final String sentAt;
}
