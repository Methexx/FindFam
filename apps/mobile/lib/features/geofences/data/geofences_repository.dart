import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/geofence.dart';

class GeofencesRepository {
  GeofencesRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<Geofence>> listGeofences(String circleId) async {
    try {
      final response = await _apiClient.dio.get('/circles/$circleId/geofences');
      final data = response.data['data'] as List<dynamic>;
      return data.map((g) => Geofence.fromJson(g as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<Geofence> createGeofence(
    String circleId, {
    required String name,
    required double lat,
    required double lng,
    required int radiusMeters,
  }) async {
    try {
      final response = await _apiClient.dio.post(
        '/circles/$circleId/geofences',
        data: {
          'name': name,
          'center': {'lat': lat, 'lng': lng},
          'radiusMeters': radiusMeters,
        },
      );
      return Geofence.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> deleteGeofence(String id) async {
    try {
      await _apiClient.dio.delete('/geofences/$id');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
