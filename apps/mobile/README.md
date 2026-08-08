# mobile

A new Flutter project.

## Error tracking

Sentry is wired in `lib/main.dart` but reads its DSN from a compile-time
define rather than a checked-in file (same treatment as `firebase_options.dart`
— gitignored, provided per-environment). Run/build with:

```
flutter run --dart-define=SENTRY_DSN=<your-dsn>
```

Omitting the flag is safe — an empty DSN is a valid no-op for local dev.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
