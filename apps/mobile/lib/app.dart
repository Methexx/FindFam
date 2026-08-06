import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'features/auth/ui/home_placeholder_screen.dart';
import 'features/auth/ui/login_screen.dart';
import 'features/auth/viewmodel/auth_notifier.dart';

class FamShareApp extends ConsumerStatefulWidget {
  const FamShareApp({super.key});

  @override
  ConsumerState<FamShareApp> createState() => _FamShareAppState();
}

class _FamShareAppState extends ConsumerState<FamShareApp> {
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
      title: 'FamShare',
      home: home,
    );
  }
}
