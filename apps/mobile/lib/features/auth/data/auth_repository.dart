import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../domain/user.dart';

class AuthRepository {
  AuthRepository({required ApiClient apiClient, required SecureStorage secureStorage})
      : _apiClient = apiClient,
        _secureStorage = secureStorage;

  final ApiClient _apiClient;
  final SecureStorage _secureStorage;

  Future<User> register({
    required String username,
    required String email,
    required String password,
    String? phone,
  }) async {
    try {
      final response = await _apiClient.dio.post('/auth/register', data: {
        'username': username,
        'email': email,
        'password': password,
        'phone': ?phone,
      });
      final data = response.data['data'] as Map<String, dynamic>;
      await _saveTokens(data['tokens'] as Map<String, dynamic>);
      return User.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<User> login({required String usernameOrEmail, required String password}) async {
    try {
      final response = await _apiClient.dio.post('/auth/login', data: {
        'usernameOrEmail': usernameOrEmail,
        'password': password,
      });
      final data = response.data['data'] as Map<String, dynamic>;
      await _saveTokens(data['tokens'] as Map<String, dynamic>);
      return User.fromJson(data['user'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<User> getMe() async {
    try {
      final response = await _apiClient.dio.get('/auth/me');
      return User.fromJson(response.data['data'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw mapDioException(e);
    }
  }

  Future<void> logout() async {
    final refreshToken = await _secureStorage.readRefreshToken();
    if (refreshToken != null) {
      try {
        await _apiClient.dio.post('/auth/logout', data: {'refreshToken': refreshToken});
      } on DioException {
        // Best-effort - clear local session regardless of server outcome.
      }
    }
    await _secureStorage.clear();
  }

  Future<bool> hasStoredSession() async {
    final accessToken = await _secureStorage.readAccessToken();
    return accessToken != null;
  }

  Future<void> _saveTokens(Map<String, dynamic> tokens) {
    return _secureStorage.saveTokens(
      accessToken: tokens['accessToken'] as String,
      refreshToken: tokens['refreshToken'] as String,
    );
  }
}
