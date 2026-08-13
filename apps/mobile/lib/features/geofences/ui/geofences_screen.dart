import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../shared/widgets/app_empty_state.dart';
import '../../../shared/widgets/app_error_text.dart';
import '../viewmodel/geofences_notifier.dart';

class GeofencesScreen extends ConsumerStatefulWidget {
  const GeofencesScreen({super.key, required this.circleId, required this.isOwner});

  final String circleId;
  final bool isOwner;

  @override
  ConsumerState<GeofencesScreen> createState() => _GeofencesScreenState();
}

class _GeofencesScreenState extends ConsumerState<GeofencesScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() => ref.read(geofencesNotifierProvider(widget.circleId).notifier).load());
  }

  Future<void> _showAddDialog() async {
    final nameController = TextEditingController();
    final latController = TextEditingController();
    final lngController = TextEditingController();
    final radiusController = TextEditingController(text: '200');

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Add geofence'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            TextField(
              controller: latController,
              decoration: const InputDecoration(labelText: 'Latitude'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            ),
            TextField(
              controller: lngController,
              decoration: const InputDecoration(labelText: 'Longitude'),
              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
            ),
            TextField(
              controller: radiusController,
              decoration: const InputDecoration(labelText: 'Radius (meters)'),
              keyboardType: TextInputType.number,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Add'),
          ),
        ],
      ),
    );

    if (result != true) return;

    final name = nameController.text.trim();
    final lat = double.tryParse(latController.text.trim());
    final lng = double.tryParse(lngController.text.trim());
    final radius = int.tryParse(radiusController.text.trim());
    if (name.isEmpty || lat == null || lng == null || radius == null) return;

    await ref.read(geofencesNotifierProvider(widget.circleId).notifier).createGeofence(
          name: name,
          lat: lat,
          lng: lng,
          radiusMeters: radius,
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(geofencesNotifierProvider(widget.circleId));

    return Scaffold(
      appBar: AppBar(title: const Text('Geofences')),
      floatingActionButton: widget.isOwner
          ? FloatingActionButton(
              onPressed: _showAddDialog,
              child: const Icon(Icons.add_location_alt),
            )
          : null,
      body: switch (state) {
        GeofencesInitial() || GeofencesLoading() =>
          const Center(child: CircularProgressIndicator()),
        GeofencesError(:final message) => Center(child: Text(message)),
        GeofencesLoaded(
          geofences: final geofences,
          actionError: final actionError,
          lastEnteredName: final lastEnteredName,
        ) =>
          Column(
            children: [
              if (lastEnteredName != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text('Someone just entered "$lastEnteredName"'),
                ),
              if (actionError != null)
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: AppErrorText(actionError),
                ),
              if (geofences.isEmpty)
                const Expanded(
                  child: AppEmptyState(
                    icon: Icons.fence_outlined,
                    message: 'No geofences yet — add one to get alerted when a member arrives',
                  ),
                )
              else
                Expanded(
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: geofences.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final geofence = geofences[index];
                      return Card(
                        child: ListTile(
                          leading: const Icon(Icons.fence),
                          title: Text(geofence.name),
                          subtitle: Text('${geofence.radiusMeters}m radius'),
                          trailing: widget.isOwner
                              ? IconButton(
                                  icon: const Icon(Icons.remove_circle_outline),
                                  onPressed: () => ref
                                      .read(geofencesNotifierProvider(widget.circleId).notifier)
                                      .deleteGeofence(geofence.id),
                                )
                              : null,
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
      },
    );
  }
}
