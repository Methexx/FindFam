import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../auth/domain/user.dart';

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

  Future<User> updateProfile({
    String? username,
    String? displayName,
    String? phone,
  }) async {
    try {
      final response = await _apiClient.dio.patch(
        '/auth/me',
        data: {
          'username': ?username,
          'displayName': ?displayName,
          'phone': ?phone,
        },
      );
      return User.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<User> uploadAvatar(File image) async {
    try {
      final response = await _apiClient.dio.post(
        '/auth/me/avatar',
        data: FormData.fromMap({
          'file': await MultipartFile.fromFile(image.path),
        }),
      );
      return User.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _apiClient.dio.patch(
        '/auth/me/password',
        data: {'currentPassword': currentPassword, 'newPassword': newPassword},
      );
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> deactivateAccount() async {
    try {
      await _apiClient.dio.post('/auth/me/deactivate');
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }
}
