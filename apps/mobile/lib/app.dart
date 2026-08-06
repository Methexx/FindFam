import 'package:flutter/material.dart';

// TODO: Sprint 1 — wrap with ProviderScope (Riverpod) and go_router setup

class FamShareApp extends StatelessWidget {
  const FamShareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FamShare',
      home: const Scaffold(
        body: Center(child: Text('FamShare')),
      ),
    );
  }
}
