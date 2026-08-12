import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'app.dart';
import 'firebase_options.dart';

// DSN is provided at build/run time via --dart-define=SENTRY_DSN=... rather
// than checked in, same treatment as firebase_options.dart's gitignored
// per-environment config. Empty string is a valid no-op DSN for local dev.
const _sentryDsn = String.fromEnvironment('SENTRY_DSN');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase must never gate the first frame. It used to be awaited here
  // before runApp(), so anything that makes it hang or fail on a real
  // device — no path to Google's servers on a restrictive network, a
  // pending Play Services update, this build's signing key not being
  // registered for the Firebase app, all things an emulator can sidestep —
  // left the user staring at Android's plain launch-theme window (solid
  // black under system dark mode) forever, with no crash and nothing to
  // explain it. Push notifications and crash reporting are both fine to
  // come up a moment late; the app being visible at all is not negotiable.
  unawaited(_initFirebase());

  await SentryFlutter.init(
    (options) {
      options.dsn = _sentryDsn;
      options.tracesSampleRate = 1.0;
    },
    appRunner: () => runApp(const ProviderScope(child: FindFamApp())),
  );
}

Future<void> _initFirebase() async {
  try {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)
        .timeout(const Duration(seconds: 10));
  } catch (error, stackTrace) {
    debugPrint('Firebase init failed or timed out, continuing without it: $error');
    // Sentry is started immediately after this future is fired off (see
    // above) and does no network work during init, so by the time a real
    // device actually hits this catch — seconds later, at best — it's
    // already initialized and safe to report through.
    unawaited(Sentry.captureException(error, stackTrace: stackTrace));
  }
}
