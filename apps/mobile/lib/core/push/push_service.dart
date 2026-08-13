import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/viewmodel/auth_notifier.dart' show apiClientProvider;
import '../../firebase_options.dart';
import '../network/api_client.dart';

/// Runs in a separate background isolate with no access to app state, so —
/// unlike everywhere else Firebase is touched — it must initialize Firebase
/// itself before doing anything. The notification payload FCM sends always
/// carries a `notification` block (see backend `lib/fcm.ts`), which Android
/// displays automatically while the app is backgrounded or killed; this
/// handler's job is only to exist, since `onBackgroundMessage` requires a
/// registered top-level function before background delivery works at all.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
}

/// Registers this device's FCM token with the backend, and keeps it current
/// across token rotation. Deliberately outside `AuthNotifier` — see
/// docs/09-sprint-timeline.md Sprint 7: platform channels stay out of the
/// auth state machine, and existing widget tests that never transition
/// through `AuthAuthenticated` keep passing without a Firebase mock.
class PushService {
  PushService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<void> registerForCurrentUser() async {
    final messaging = FirebaseMessaging.instance;
    final settings = await messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) return;

    final token = await messaging.getToken();
    if (token != null) {
      await _sendToken(token);
    }

    messaging.onTokenRefresh.listen(_sendToken);
  }

  Future<void> _sendToken(String token) async {
    try {
      await _apiClient.dio.put('/auth/fcm-token', data: {'fcmToken': token});
    } on DioException {
      // Best-effort — a failed registration just means the next cold start
      // or token refresh tries again. There's no user-facing action to take.
    }
  }
}

final pushServiceProvider = Provider<PushService>((ref) {
  return PushService(apiClient: ref.read(apiClientProvider));
});
