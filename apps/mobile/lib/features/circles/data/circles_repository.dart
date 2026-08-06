import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/circle.dart';

class CirclesRepository {
  CirclesRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<Circle> createCircle(String name) async {
    try {
      final response = await _apiClient.dio.post('/circles', data: {'name': name});
      return Circle.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<Circle>> listCircles() async {
    try {
      final response = await _apiClient.dio.get('/circles');
      final data = response.data['data'] as List<dynamic>;
      return data.map((c) => Circle.fromJson(c as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<CircleWithMembers> getCircle(String circleId) async {
    try {
      final response = await _apiClient.dio.get('/circles/$circleId');
      return CircleWithMembers.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> updateCircleName(String circleId, String name) async {
    try {
      await _apiClient.dio.patch('/circles/$circleId', data: {'name': name});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> deleteCircle(String circleId) async {
    try {
      await _apiClient.dio.delete('/circles/$circleId');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> addMember(String circleId, String username) async {
    try {
      await _apiClient.dio.post('/circles/$circleId/members', data: {'username': username});
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> removeMember(String circleId, String userId) async {
    try {
      await _apiClient.dio.delete('/circles/$circleId/members/$userId');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
