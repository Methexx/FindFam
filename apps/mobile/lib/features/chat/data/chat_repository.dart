import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/message.dart';

class MessagesPage {
  const MessagesPage({required this.messages, required this.nextCursor});
  final List<Message> messages;
  final String? nextCursor;
}

class ChatRepository {
  ChatRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<MessagesPage> listMessages(String circleId, {String? cursor}) async {
    try {
      final response = await _apiClient.dio.get(
        '/circles/$circleId/messages',
        queryParameters: {if (cursor != null) 'cursor': cursor},
      );
      final data = response.data['data'] as Map<String, dynamic>;
      final messages = (data['messages'] as List<dynamic>)
          .map((m) => Message.fromJson(m as Map<String, dynamic>))
          .toList();
      return MessagesPage(messages: messages, nextCursor: data['nextCursor'] as String?);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Message> sendMessage(String circleId, String content) async {
    try {
      final response = await _apiClient.dio.post(
        '/circles/$circleId/messages',
        data: {'content': content},
      );
      return Message.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
