import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/follow.dart';

class FollowsRepository {
  FollowsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Follow> sendFollowRequest(String followeeUsername) async {
    try {
      final response = await _apiClient.dio.post('/follows', data: {
        'followeeUsername': followeeUsername,
      });
      return Follow.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> respondToFollow(String followId, {required bool accept}) async {
    try {
      await _apiClient.dio.patch('/follows/$followId', data: {
        'action': accept ? 'accept' : 'reject',
      });
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> removeFollow(String followId) async {
    try {
      await _apiClient.dio.delete('/follows/$followId');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<Follow>> getPending() async {
    try {
      final response = await _apiClient.dio.get('/follows/pending');
      final data = response.data['data'] as List<dynamic>;
      return data.map((f) => Follow.fromJson(f as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<Follow>> getAccepted() async {
    try {
      final response = await _apiClient.dio.get('/follows');
      final data = response.data['data'] as List<dynamic>;
      return data.map((f) => Follow.fromJson(f as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
