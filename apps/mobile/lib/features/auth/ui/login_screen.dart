import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../viewmodel/auth_notifier.dart';
import 'register_screen.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _usernameOrEmailController = TextEditingController();
  final _passwordController = TextEditingController();

  @override
  void dispose() {
    _usernameOrEmailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final isLoading = authState is AuthLoading;

    return Scaffold(
      appBar: AppBar(title: const Text('Log in')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _usernameOrEmailController,
              decoration: const InputDecoration(labelText: 'Username or email'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _passwordController,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            const SizedBox(height: 24),
            if (authState is AuthUnauthenticated && authState.error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(authState.error!, style: const TextStyle(color: Colors.red)),
              ),
            FilledButton(
              onPressed: isLoading
                  ? null
                  : () => ref.read(authNotifierProvider.notifier).login(
                        usernameOrEmail: _usernameOrEmailController.text,
                        password: _passwordController.text,
                      ),
              child: isLoading
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Log in'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const RegisterScreen()),
              ),
              child: const Text("Don't have an account? Register"),
            ),
          ],
        ),
      ),
    );
  }
}
