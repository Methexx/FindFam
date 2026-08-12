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
        dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: Env.apiBaseUrl,
                // Without these, a request to an unreachable host (wrong
                // API_BASE_URL, backend down, no route to it) never fails —
                // it hangs on the OS's own TCP timeout, which can run well
                // past a minute, with the UI stuck on a spinner and no
                // error ever reaching mapDioException below.
                connectTimeout: const Duration(seconds: 15),
                receiveTimeout: const Duration(seconds: 15),
                sendTimeout: const Duration(seconds: 15),
              ),
            ) {
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
  // Checked before the response-based branches below: a timeout or a
  // connection error never has a response, so error.response?.data is
  // always null here — without this branch these fall through to the
  // generic case and surface whatever raw socket message Dio produced,
  // rather than something a user can act on.
  switch (error.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return ApiException('Could not reach the server — check your connection and try again.');
    case DioExceptionType.cancel:
    case DioExceptionType.badCertificate:
    case DioExceptionType.badResponse:
    case DioExceptionType.unknown:
    case DioExceptionType.transformTimeout:
      break;
  }

  final statusCode = error.response?.statusCode;
  final message = (error.response?.data is Map)
      ? (error.response?.data['error']?.toString() ?? error.message ?? 'Request failed')
      : (error.message ?? 'Request failed');

  if (statusCode == 401) {
    return UnauthorizedException(message);
  }
  return ApiException(message, statusCode: statusCode);
}
