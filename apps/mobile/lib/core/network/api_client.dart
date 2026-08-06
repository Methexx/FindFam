import 'package:dio/dio.dart';
import '../../config/env.dart';
import '../storage/secure_storage.dart';
import 'exceptions.dart';

/// Wraps a Dio instance with an auth header interceptor and a queued
/// 401 handler that attempts a single silent refresh before retrying the
/// original request. If the refresh itself fails, [onSessionExpired] is
/// invoked so the app can force a logout / navigate to the login screen.
class ApiClient {
  ApiClient({
    required SecureStorage secureStorage,
    Dio? dio,
  })  : _secureStorage = secureStorage,
        dio = dio ?? Dio(BaseOptions(baseUrl: Env.apiBaseUrl)) {
    this.dio.interceptors.add(
          QueuedInterceptorsWrapper(
            onRequest: _onRequest,
            onError: _onError,
          ),
        );
  }

  final Dio dio;
  final SecureStorage _secureStorage;

  /// Set by the auth layer after construction (avoids a provider cycle
  /// between ApiClient and AuthNotifier) - invoked when a silent refresh
  /// fails and the session must be force-ended.
  void Function()? onSessionExpired;

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final accessToken = await _secureStorage.readAccessToken();
    if (accessToken != null) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }
    handler.next(options);
  }

  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final isUnauthorized = error.response?.statusCode == 401;
    final isRefreshCall = error.requestOptions.path.contains('/auth/refresh');

    if (!isUnauthorized || isRefreshCall) {
      return handler.next(error);
    }

    final refreshToken = await _secureStorage.readRefreshToken();
    if (refreshToken == null) {
      onSessionExpired?.call();
      return handler.next(error);
    }

    try {
      final response = await dio.post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );
      final newAccessToken = response.data['data']['accessToken'] as String;
      await _secureStorage.saveAccessToken(newAccessToken);

      final retryOptions = error.requestOptions;
      retryOptions.headers['Authorization'] = 'Bearer $newAccessToken';
      final retryResponse = await dio.fetch(retryOptions);
      return handler.resolve(retryResponse);
    } catch (_) {
      await _secureStorage.clear();
      onSessionExpired?.call();
      return handler.next(error);
    }
  }
}

Exception mapDioException(DioException error) {
  final statusCode = error.response?.statusCode;
  final message = (error.response?.data is Map)
      ? (error.response?.data['error']?.toString() ?? error.message ?? 'Request failed')
      : (error.message ?? 'Request failed');

  if (statusCode == 401) {
    return UnauthorizedException(message);
  }
  return ApiException(message, statusCode: statusCode);
}
