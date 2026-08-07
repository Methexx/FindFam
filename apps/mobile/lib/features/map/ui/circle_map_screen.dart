import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../auth/viewmodel/auth_notifier.dart';
import '../domain/member_location.dart';
import '../viewmodel/circle_map_notifier.dart';
import '../viewmodel/location_sharing_notifier.dart';
import '../viewmodel/ws_connection_notifier.dart';
import 'location_permission_screen.dart';

class CircleMapScreen extends ConsumerStatefulWidget {
  const CircleMapScreen({super.key, required this.circleId, required this.circleName});

  final String circleId;
  final String circleName;

  @override
  ConsumerState<CircleMapScreen> createState() => _CircleMapScreenState();
}

class _CircleMapScreenState extends ConsumerState<CircleMapScreen> {
  final _mapController = MapController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(circleMapNotifierProvider(widget.circleId).notifier).load();
      // On WS reconnect, re-fetch this circle's latest state to reconcile
      // any broadcasts missed while disconnected.
      ref.read(wsClientProvider).onReconnected =
          () => ref.read(circleMapNotifierProvider(widget.circleId).notifier).reconcile();
      ref.read(wsClientProvider).connect();
    });
  }

  Future<void> _onShareTapped() async {
    final sharing = ref.read(locationSharingNotifierProvider) == LocationSharingState.on;
    if (sharing) {
      ref.read(locationSharingNotifierProvider.notifier).disableSharing();
      return;
    }
    await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const LocationPermissionScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(circleMapNotifierProvider(widget.circleId));
    final connectionStatus = ref.watch(wsConnectionStatusProvider);
    final sharingState = ref.watch(locationSharingNotifierProvider);
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : null;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.circleName),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(24),
          child: _ConnectionBanner(status: connectionStatus.value),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _onShareTapped,
        icon: Icon(sharingState == LocationSharingState.on ? Icons.stop : Icons.share_location),
        label: Text(sharingState == LocationSharingState.on ? 'Stop sharing' : 'Share location'),
      ),
      body: switch (state) {
        CircleMapInitial() => const Center(child: CircularProgressIndicator()),
        CircleMapError(:final message) => Center(child: Text(message)),
        CircleMapLoaded(locationsByUserId: final locations) => locations.isEmpty
            ? const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'No one in this circle has shared their location yet',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            : _buildMap(locations, currentUserId),
      },
    );
  }

  Widget _buildMap(Map<String, MemberLocation> locations, String? currentUserId) {
    final points = locations.values.toList();
    final center = LatLng(points.first.lat, points.first.lng);

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(initialCenter: center, initialZoom: 13),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'app.findfam.mobile',
        ),
        MarkerLayer(
          markers: points
              .map(
                (location) => Marker(
                  point: LatLng(location.lat, location.lng),
                  width: 40,
                  height: 40,
                  child: Icon(
                    Icons.location_on,
                    color: location.userId == currentUserId ? Colors.blue : Colors.red,
                    size: 36,
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _ConnectionBanner extends StatelessWidget {
  const _ConnectionBanner({required this.status});

  final WsConnectionStatus? status;

  @override
  Widget build(BuildContext context) {
    if (status == WsConnectionStatus.connected || status == null) {
      return const SizedBox.shrink();
    }
    final label = status == WsConnectionStatus.connecting ? 'Reconnecting…' : 'Offline';
    return Container(
      width: double.infinity,
      color: Colors.orange.shade100,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12)),
    );
  }
}
