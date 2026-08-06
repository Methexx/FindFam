# 08 — Flutter App Structure

## Architecture Pattern
**MVVM**, consistent with School Connect mobile. State management via **Riverpod** (recommended over Provider/Bloc for this project — good fit for WebSocket-driven realtime state, less boilerplate than Bloc for a solo dev).

## Folder Structure
```
apps/mobile/
├── lib/
│   ├── main.dart
│   ├── app.dart                          # MaterialApp, theming, routing setup
│   ├── config/
│   │   ├── env.dart                       # API base URL, WS URL (per environment)
│   │   └── theme.dart
│   ├── core/
│   │   ├── network/
│   │   │   ├── api_client.dart            # Dio/http wrapper, interceptors for auth header + refresh
│   │   │   ├── ws_client.dart             # WebSocket connection manager, reconnect/backoff logic
│   │   │   └── exceptions.dart
│   │   ├── storage/
│   │   │   └── secure_storage.dart        # flutter_secure_storage wrapper (tokens)
│   │   └── location/
│   │       ├── location_service.dart      # geolocator + background service wrapper
│   │       └── motion_detector.dart       # accelerometer-based adaptive sampling
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/                      # repository, DTOs
│   │   │   ├── domain/                    # models
│   │   │   ├── viewmodel/                 # Riverpod providers/notifiers
│   │   │   └── ui/                        # screens, widgets
│   │   ├── circles/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── viewmodel/
│   │   │   └── ui/
│   │   ├── map/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── viewmodel/                 # subscribes to WS location stream
│   │   │   └── ui/                        # live map screen, member markers
│   │   ├── chat/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── viewmodel/
│   │   │   └── ui/
│   │   ├── emergency_contacts/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── viewmodel/
│   │   │   └── ui/
│   │   ├── sos/
│   │   │   ├── data/
│   │   │   ├── domain/
│   │   │   ├── viewmodel/
│   │   │   └── ui/                        # SOS button, active-SOS banner
│   │   └── profile/
│   │       ├── data/
│   │       ├── domain/
│   │       ├── viewmodel/
│   │       └── ui/                        # sharing toggle, ghost mode (Tier 1)
│   └── shared/
│       ├── widgets/                       # reusable buttons, avatars, map markers
│       └── extensions/
├── android/                               # background location + FCM native config
├── ios/                                   # background modes + FCM native config
├── test/
└── pubspec.yaml
```

## Key Packages
| Concern | Package |
|---|---|
| State management | `flutter_riverpod` |
| HTTP client | `dio` (interceptor support for auth refresh) |
| WebSocket | `web_socket_channel` |
| Secure storage | `flutter_secure_storage` |
| Background location | `flutter_background_geolocation` (motion-adaptive, cross-platform) or `geolocator` + custom foreground service |
| Maps | `google_maps_flutter` or `flutter_map` (OpenStreetMap — avoids Google Maps billing for a solo project) |
| Push notifications | `firebase_messaging` |
| Battery level | `battery_plus` |

## State Management Pattern (Riverpod)
- **AuthNotifier** — holds current session, exposes login/logout/refresh logic, persisted via secure storage on boot
- **WsConnectionProvider** — singleton-scoped provider managing the single WebSocket connection for the whole app; other features listen to streams derived from it rather than opening their own connections
- **CircleLocationsProvider** (per circle) — derived from the WS location stream, filtered by circle, drives the live map markers
- **ChatMessagesProvider** (per circle) — combines REST-fetched history with WS-streamed new messages
- **SosProvider** — tracks whether an SOS is currently active for the user, drives the persistent "SOS active" banner

## Background Location Strategy
- Use `flutter_background_geolocation`'s motion-adaptive mode: high-frequency GPS while moving, drops to significant-change/geofence-triggered updates while stationary
- Foreground service notification required on Android for background location — this doubles as part of the "you are sharing" transparency requirement (Tier 1), not just a platform requirement to work around
- iOS: request "Always" location permission only when the user first enables sharing, with a clear in-app explanation before the system prompt (higher permission grant rate, and matches App Store review expectations for background location apps)

## Navigation
`go_router` recommended — deep-linkable (useful for push-notification-triggered navigation straight to an active SOS event or a circle chat), and integrates cleanly with Riverpod for auth-gated route redirection.

## Offline / Poor Connectivity Handling
- Queue outgoing chat messages locally if WS is disconnected, retry on reconnect
- SOS trigger always attempts both WS and REST simultaneously (see 07-data-flow) — never depend solely on WS for this action
- Cache last-known circle member locations locally so the map isn't blank on a cold start before the first WS message arrives
