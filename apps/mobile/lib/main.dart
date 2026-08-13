import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:sentry_flutter/sentry_flutter.dart';
import 'app.dart';
import 'config/env.dart';
import 'core/map/map_tile_config.dart';
import 'firebase_options.dart';

// DSN is provided at build/run time via --dart-define=SENTRY_DSN=... rather
// than checked in, same treatment as firebase_options.dart's gitignored
// per-environment config. Empty string is a valid no-op DSN for local dev.
const _sentryDsn = String.fromEnvironment('SENTRY_DSN');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Local disk I/O only (no network), so unlike Firebase below this is safe
  // to await directly — it won't hang the first frame on a bad connection.
  await FMTCObjectBoxBackend().initialise();
  await const FMTCStore(kMapCacheStoreName).manage.create();

  // Dart-defines don't persist across `flutter run` invocations, so a
  // forgotten --dart-define=API_BASE_URL=... on a rerun silently falls back
  // to the emulator-only 10.0.2.2 default and looks identical to a real
  // network/firewall problem on a physical device. Printing the resolved
  // URLs on every launch turns "is my flag even taking effect" from a guess
  // into something visible in the console immediately.
  debugPrint('API_BASE_URL=${Env.apiBaseUrl}  WS_URL=${Env.wsUrl}');

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
    // A PlatformException(channel-error, ...) here on a real device (as
    // opposed to failing to build at all) is almost always one of two
    // things, in order of likelihood: (1) Google Play Services on this
    // specific device is outdated or unreachable, or (2) the debug
    // keystore's SHA-1 fingerprint isn't registered against this app in
    // the Firebase console — common when the project's Firebase config
    // (google-services.json / firebase_options.dart) was originally
    // generated on a different machine than the one currently building.
    // Neither is fixable from here; check Play Services and the console.
    debugPrint('Firebase init failed or timed out, continuing without it: $error');
    // Sentry is started immediately after this future is fired off (see
    // above) and does no network work during init, so by the time a real
    // device actually hits this catch — seconds later, at best — it's
    // already initialized and safe to report through.
    unawaited(Sentry.captureException(error, stackTrace: stackTrace));
  }
}
