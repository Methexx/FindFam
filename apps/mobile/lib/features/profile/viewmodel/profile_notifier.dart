import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../../map/viewmodel/location_sharing_notifier.dart';
import '../data/profile_repository.dart';

class ProfileState {
  const ProfileState({this.error, this.isUpdating = false});
  final String? error;
  final bool isUpdating;
}

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(apiClient: ref.read(apiClientProvider));
});

final profileNotifierProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  return ProfileNotifier(ref.read(profileRepositoryProvider), ref);
});

/// Toggling sharing both starts/stops the local GPS capture (existing
/// LocationSharingNotifier, unchanged from Sprint 3) and persists
/// users.is_sharing server-side — previously only the local toggle existed,
/// with no server-side record for other circle members' clients or the
/// admin dashboard to read.
class ProfileNotifier extends StateNotifier<ProfileState> {
  ProfileNotifier(this._repository, this._ref) : super(const ProfileState());

  final ProfileRepository _repository;
  final Ref _ref;

  Future<void> setSharing(bool enabled) async {
    state = const ProfileState(isUpdating: true);
    try {
      if (enabled) {
        final granted =
            await _ref.read(locationSharingNotifierProvider.notifier).enableSharing();
        if (!granted) {
          state = const ProfileState(error: 'Location permission was not granted');
          return;
        }
      } else {
        _ref.read(locationSharingNotifierProvider.notifier).disableSharing();
      }

      await _repository.updateSharingStatus(enabled);
      state = const ProfileState();
    } catch (e) {
      state = ProfileState(error: e.toString());
    }
  }
}
