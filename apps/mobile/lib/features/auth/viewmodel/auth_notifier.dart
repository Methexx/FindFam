import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../config/dev_auth.dart';
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

  /// Debug-only shortcut past the login screen.
  ///
  /// Deliberately performs a *real* login (falling back to registering the
  /// account the first time) rather than faking an authenticated state with
  /// a synthetic user. A fake session has no access token, so every screen
  /// behind it would 401 and the app would be useless for exactly the dev
  /// work this exists to speed up. One tap, real token, everything works.
  ///
  /// Only ever called from a `kDebugMode`-gated button — see LoginScreen.
  Future<void> devSignIn() async {
    assert(kDebugMode, 'devSignIn must never be reachable in a release build');
    state = const AuthLoading();

    try {
      state = AuthAuthenticated(
        await _repository.login(
          usernameOrEmail: DevAuth.username,
          password: DevAuth.password,
        ),
      );
      return;
    } catch (_) {
      // Most likely the dev account doesn't exist on this backend yet.
      // Fall through and create it.
    }

    try {
      state = AuthAuthenticated(
        await _repository.register(
          username: DevAuth.username,
          email: DevAuth.email,
          password: DevAuth.password,
        ),
      );
    } catch (e) {
      // Both paths failed, which almost always means the backend isn't
      // reachable. Say so plainly rather than dropping into a fake session
      // that would fail confusingly on the next screen.
      state = AuthUnauthenticated(
        'Dev sign-in failed — is the backend running and API_BASE_URL correct? ($e)',
      );
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
