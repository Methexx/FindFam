import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';

class ProfileRepository {
  ProfileRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<bool> updateSharingStatus(bool isSharing) async {
    try {
      final response = await _apiClient.dio.patch(
        '/locations/sharing-status',
        data: {'isSharing': isSharing},
      );
      final data = response.data['data'] as Map<String, dynamic>;
      return data['isSharing'] as bool;
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
