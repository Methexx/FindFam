import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/utils/time_ago.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../domain/member_location.dart';
import '../viewmodel/circle_map_notifier.dart';
import '../viewmodel/location_sharing_notifier.dart';
import '../viewmodel/ws_connection_notifier.dart';
import 'location_permission_screen.dart';
import 'member_location_format.dart';
import 'member_marker.dart';

class CircleMapScreen extends ConsumerStatefulWidget {
  const CircleMapScreen({super.key, required this.circleId, required this.circleName});

  final String circleId;
  final String circleName;

  @override
  ConsumerState<CircleMapScreen> createState() => _CircleMapScreenState();
}

class _CircleMapScreenState extends ConsumerState<CircleMapScreen> {
  final _mapController = MapController();
  bool _showMemberList = false;

  // The map fits every member's pin once, right after the first load — not
  // on every subsequent broadcast, or the view would jump under the user's
  // finger every time someone's position ticks. After that, fitting again is
  // an explicit action via the recenter button.
  bool _hasFitBounds = false;

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

  void _fitToMembers(Iterable<MemberLocation> locations) {
    final points = locations.map((l) => LatLng(l.lat, l.lng)).toList();
    if (points.isEmpty) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.coordinates(
          coordinates: points,
          padding: const EdgeInsets.fromLTRB(40, 80, 40, 40),
          maxZoom: 16,
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(circleMapNotifierProvider(widget.circleId));
    final connectionStatus = ref.watch(wsConnectionStatusProvider);
    final sharingState = ref.watch(locationSharingNotifierProvider);
    final authState = ref.watch(authNotifierProvider);
    final currentUserId = authState is AuthAuthenticated ? authState.user.id : null;

    final Map<String, MemberLocation> locations =
        state is CircleMapLoaded ? state.locationsByUserId : const {};
    if (state is CircleMapLoaded && locations.isNotEmpty && !_hasFitBounds) {
      _hasFitBounds = true;
      _fitToMembers(locations.values);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.circleName),
        actions: [
          if (!_showMemberList && locations.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.center_focus_strong_outlined),
              tooltip: 'Recenter map',
              onPressed: () => _fitToMembers(locations.values),
            ),
          IconButton(
            icon: Icon(_showMemberList ? Icons.map_outlined : Icons.list_alt_outlined),
            tooltip: _showMemberList ? 'Show map' : 'Show member details',
            onPressed: () => setState(() => _showMemberList = !_showMemberList),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(36),
          child: _ConnectionBanner(status: connectionStatus.value),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _onShareTapped,
        icon: Icon(sharingState == LocationSharingState.on ? Icons.stop_circle_outlined : Icons.share_location),
        label: Text(sharingState == LocationSharingState.on ? 'Stop sharing' : 'Share location'),
      ),
      body: switch (state) {
        CircleMapInitial() => const Center(child: CircularProgressIndicator()),
        CircleMapError(:final message) => Center(child: Text(message)),
        CircleMapLoaded(locationsByUserId: final locations) => locations.isEmpty
            ? const AppEmptyState(
                icon: Icons.location_off_outlined,
                message: 'No one in this circle has shared their location yet',
              )
            : _showMemberList
                ? _buildMemberList(locations, currentUserId)
                : _buildMap(locations, currentUserId),
      },
    );
  }

  Widget _buildMemberList(Map<String, MemberLocation> locations, String? currentUserId) {
    final points = locations.values.toList()
      ..sort((a, b) => a.userId == currentUserId ? -1 : (b.userId == currentUserId ? 1 : 0));

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: points.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final location = points[index];
        final isSelf = location.userId == currentUserId;
        final markerColor = isSelf ? AppColors.selfMarker : AppColors.memberMarker;
        final stale = location.isStale;

        return Card(
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            onTap: () => showMemberDetailsSheet(context, location: location, isSelf: isSelf),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Opacity(
                    opacity: stale ? 0.5 : 1,
                    child: CircleAvatar(
                      radius: 22,
                      backgroundColor: markerColor.withValues(alpha: 0.14),
                      child: Icon(isSelf ? Icons.my_location : Icons.person, color: markerColor),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isSelf ? 'You' : location.displayName,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${formatSpeed(location.speed)} · ${formatBattery(location.batteryLevel)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  _FreshnessTag(location: location),
                ],
              ),
            ),
          ),
        );
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
                  width: MemberMarker.size,
                  height: MemberMarker.size,
                  child: MemberMarker(
                    location: location,
                    isSelf: location.userId == currentUserId,
                    onTap: () => showMemberDetailsSheet(
                      context,
                      location: location,
                      isSelf: location.userId == currentUserId,
                    ),
                  ),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

/// "just now" in an unobtrusive dot, or an amber "Xm ago" tag once a pin is
/// stale enough that showing it as live would be misleading.
class _FreshnessTag extends StatelessWidget {
  const _FreshnessTag({required this.location});

  final MemberLocation location;

  @override
  Widget build(BuildContext context) {
    if (!location.isStale) {
      return Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF2E7D32)),
      );
    }
    return Text(
      timeAgo(location.recordedAtLocal),
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.offline),
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
    final connecting = status == WsConnectionStatus.connecting;
    final label = connecting ? 'Reconnecting…' : 'Offline — showing last known positions';

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.offline.withValues(alpha: 0.16),
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (connecting)
              const SizedBox(
                width: 12,
                height: 12,
                child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.offline),
              )
            else
              const Icon(Icons.wifi_off, size: 14, color: AppColors.offline),
            const SizedBox(width: 6),
            Flexible(
              child: Text(
                label,
                textAlign: TextAlign.center,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.offline,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
