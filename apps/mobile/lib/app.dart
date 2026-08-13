import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/push/push_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/ui/home_placeholder_screen.dart';
import 'features/auth/ui/login_screen.dart';
import 'features/auth/viewmodel/auth_notifier.dart';
import 'features/map/data/location_cache.dart';
import 'features/map/viewmodel/location_sharing_notifier.dart';
import 'features/map/viewmodel/ws_connection_notifier.dart';

class FindFamApp extends ConsumerStatefulWidget {
  const FindFamApp({super.key});

  @override
  ConsumerState<FindFamApp> createState() => _FindFamAppState();
}

class _FindFamAppState extends ConsumerState<FindFamApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(authNotifierProvider.notifier).restoreSession());
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    // Deliberately outside AuthNotifier and split into two independent
    // effects rather than one branch per direction: push registration only
    // ever needs a fresh token on sign-in (the FCM DELETE on sign-out is a
    // network call and belongs in AuthRepository.logout(), which still has
    // a valid access token when it runs); teardown must fire on every
    // transition to unauthenticated, including forceLogout()'s synchronous
    // path, which has no access token and can't reach the network at all.
    ref.listen(authNotifierProvider, (previous, next) {
      if (next is AuthAuthenticated && previous is! AuthAuthenticated) {
        unawaited(ref.read(pushServiceProvider).registerForCurrentUser());
      }
      if (next is AuthUnauthenticated && previous is! AuthUnauthenticated) {
        ref.read(wsClientProvider).disconnect();
        ref.read(locationSharingNotifierProvider.notifier).disableSharing();
        LocationCache.instance.clear();
      }
    });

    final Widget home = switch (authState) {
      AuthAuthenticated(user: final user) => HomePlaceholderScreen(username: user.username),
      AuthUnauthenticated() => const LoginScreen(),
      AuthInitial() || AuthLoading() => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
    };

    return MaterialApp(
      title: 'FindFam',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ThemeMode.system,
      home: home,
    );
  }
}
