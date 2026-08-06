import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../data/auth_repository.dart';
import '../domain/user.dart';

sealed class AuthState {
  const AuthState();
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.user);
  final User user;
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated([this.error]);
  final String? error;
}

final secureStorageProvider = Provider<SecureStorage>((ref) => SecureStorage());

final apiClientProvider = Provider<ApiClient>((ref) {
  final secureStorage = ref.read(secureStorageProvider);
  return ApiClient(secureStorage: secureStorage);
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    apiClient: ref.read(apiClientProvider),
    secureStorage: ref.read(secureStorageProvider),
  );
});

final authNotifierProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final notifier = AuthNotifier(ref.read(authRepositoryProvider));
  ref.read(apiClientProvider).onSessionExpired = notifier.forceLogout;
  return notifier;
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier(this._repository) : super(const AuthInitial());

  final AuthRepository _repository;

  Future<void> restoreSession() async {
    state = const AuthLoading();
    final hasSession = await _repository.hasStoredSession();
    if (!hasSession) {
      state = const AuthUnauthenticated();
      return;
    }

    try {
      final user = await _repository.getMe();
      state = AuthAuthenticated(user);
    } catch (_) {
      state = const AuthUnauthenticated();
    }
  }

  Future<void> register({
    required String username,
    required String email,
    required String password,
    String? phone,
  }) async {
    state = const AuthLoading();
    try {
      final user = await _repository.register(
        username: username,
        email: email,
        password: password,
        phone: phone,
      );
      state = AuthAuthenticated(user);
    } catch (e) {
      state = AuthUnauthenticated(e.toString());
    }
  }

  Future<void> login({required String usernameOrEmail, required String password}) async {
    state = const AuthLoading();
    try {
      final user = await _repository.login(usernameOrEmail: usernameOrEmail, password: password);
      state = AuthAuthenticated(user);
    } catch (e) {
      state = AuthUnauthenticated(e.toString());
    }
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthUnauthenticated();
  }

  void forceLogout() {
    state = const AuthUnauthenticated('Session expired');
  }
}
