import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../domain/sos_event.dart';

class SosRepository {
  SosRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<SosEvent> triggerSos({required double lat, required double lng}) async {
    try {
      final response = await _apiClient.dio.post('/sos', data: {'lat': lat, 'lng': lng});
      return SosEvent.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<SosEvent> resolveSos(String id) async {
    try {
      final response = await _apiClient.dio.patch('/sos/$id/resolve');
      return SosEvent.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<List<SosEvent>> listActiveSos() async {
    try {
      final response = await _apiClient.dio.get('/sos/active');
      final data = response.data['data'] as List<dynamic>;
      return data.map((e) => SosEvent.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
