import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/member_location.dart';

class LocationsRepository {
  LocationsRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<List<MemberLocation>> getLatestForCircle(String circleId) async {
    try {
      final response = await _apiClient.dio.get('/circles/$circleId/locations/latest');
      final data = response.data['data'] as List<dynamic>;
      return data.map((l) => MemberLocation.fromJson(l as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> postLocation({
    required double lat,
    required double lng,
    double? speed,
    int? batteryLevel,
  }) async {
    try {
      await _apiClient.dio.post(
        '/locations',
        data: {
          'lat': lat,
          'lng': lng,
          if (speed != null) 'speed': speed,
          if (batteryLevel != null) 'batteryLevel': batteryLevel,
        },
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
