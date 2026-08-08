import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/ui/home_placeholder_screen.dart';
import 'features/auth/ui/login_screen.dart';
import 'features/auth/viewmodel/auth_notifier.dart';

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
