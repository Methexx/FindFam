import 'package:flutter/material.dart';

import '../../../core/theme/app_colors.dart';
import '../../../shared/utils/time_ago.dart';
import '../domain/member_location.dart';
import 'member_location_format.dart';

/// A circle-map pin: a colored avatar ring (self vs. other member), faded
/// and badged once its last update is stale, tappable for the full detail
/// sheet. Deliberately not a teardrop/pointer pin — an avatar centered
/// exactly on the coordinate reads clearly at circle-sized member counts and
/// avoids fighting flutter_map's anchor math for a shape that doesn't need it.
class MemberMarker extends StatelessWidget {
  const MemberMarker({super.key, required this.location, required this.isSelf, this.onTap});

  final MemberLocation location;
  final bool isSelf;
  final VoidCallback? onTap;

  static const double size = 44;

  @override
  Widget build(BuildContext context) {
    final ringColor = isSelf ? AppColors.selfMarker : AppColors.memberMarker;
    final stale = location.isStale;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Opacity(
        opacity: stale ? 0.55 : 1,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white,
                border: Border.all(color: ringColor, width: 3),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.25),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Icon(
                isSelf ? Icons.my_location : Icons.person,
                color: ringColor,
                size: 22,
              ),
            ),
            if (stale)
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  padding: const EdgeInsets.all(2),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                  ),
                  child: Icon(Icons.schedule, size: 13, color: Theme.of(context).colorScheme.outline),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Tapping a marker (or its member-list row) opens this instead of the map
/// needing a permanent overlay — the same info, on demand.
Future<void> showMemberDetailsSheet(
  BuildContext context, {
  required MemberLocation location,
  required bool isSelf,
}) {
  final colorScheme = Theme.of(context).colorScheme;
  final ringColor = isSelf ? AppColors.selfMarker : AppColors.memberMarker;

  return showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (context) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: colorScheme.outlineVariant,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: ringColor.withValues(alpha: 0.12),
                      border: Border.all(color: ringColor, width: 2),
                    ),
                    child: Icon(isSelf ? Icons.my_location : Icons.person, color: ringColor),
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
                        Text(
                          location.isStale
                              ? 'Last seen ${timeAgo(location.recordedAtLocal)}'
                              : 'Updated ${timeAgo(location.recordedAtLocal)}',
                          style: TextStyle(
                            fontSize: 13,
                            color: location.isStale ? AppColors.offline : colorScheme.onSurfaceVariant,
                            fontWeight: location.isStale ? FontWeight.w600 : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _DetailStat(
                      icon: Icons.speed,
                      label: formatSpeed(location.speed),
                    ),
                  ),
                  Expanded(
                    child: _DetailStat(
                      icon: Icons.battery_std,
                      label: formatBattery(location.batteryLevel),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

class _DetailStat extends StatelessWidget {
  const _DetailStat({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return Row(
      children: [
        Icon(icon, size: 18, color: colorScheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Flexible(
          child: Text(label, style: TextStyle(fontSize: 13, color: colorScheme.onSurfaceVariant)),
        ),
      ],
    );
  }
}
