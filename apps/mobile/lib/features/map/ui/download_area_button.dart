import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_tile_caching/flutter_map_tile_caching.dart';

import '../../../core/map/map_tile_config.dart';

/// Downloads the map area currently on screen (plus a couple of zoom levels
/// either side) into the shared offline tile cache, so it renders instantly
/// — even with no signal — next time it's viewed.
class DownloadAreaButton extends StatelessWidget {
  const DownloadAreaButton({super.key, required this.mapController, required this.heroTag});

  final MapController mapController;
  final String heroTag;

  Future<void> _startDownload(BuildContext context) async {
    final camera = mapController.camera;
    final zoom = camera.zoom.round();
    final region = RectangleRegion(camera.visibleBounds).toDownloadable(
      minZoom: (zoom - 1).clamp(1, 19),
      maxZoom: (zoom + 2).clamp(1, 19),
      options: TileLayer(
        urlTemplate: kMapTileUrlTemplate,
        userAgentPackageName: kMapUserAgentPackageName,
      ),
    );

    final progress = const FMTCStore(kMapCacheStoreName).download.startForeground(region: region);

    if (!context.mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isDismissible: false,
      enableDrag: false,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _DownloadProgressSheet(progress: progress),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FloatingActionButton.small(
      heroTag: heroTag,
      tooltip: 'Save this area for offline use',
      onPressed: () => _startDownload(context),
      child: const Icon(Icons.download_for_offline_outlined),
    );
  }
}

class _DownloadProgressSheet extends StatelessWidget {
  const _DownloadProgressSheet({required this.progress});

  final Stream<DownloadProgress> progress;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: StreamBuilder<DownloadProgress>(
          stream: progress,
          builder: (context, snapshot) {
            final data = snapshot.data;
            final done = data?.isComplete ?? false;

            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  done ? 'Area saved for offline use' : 'Saving this area for offline use…',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 16),
                LinearProgressIndicator(value: data == null ? 0 : data.percentageProgress / 100),
                const SizedBox(height: 8),
                Text(
                  data == null ? 'Starting…' : '${data.attemptedTiles} / ${data.maxTiles} tiles',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: colorScheme.onSurfaceVariant),
                ),
                const SizedBox(height: 20),
                if (done)
                  FilledButton(
                    onPressed: () => Navigator.of(context).pop(),
                    child: const Text('Done'),
                  )
                else
                  OutlinedButton(
                    onPressed: () => const FMTCStore(kMapCacheStoreName).download.cancel(),
                    child: const Text('Cancel'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
