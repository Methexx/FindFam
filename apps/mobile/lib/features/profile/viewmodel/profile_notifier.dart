import 'dart:io';
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

/// One notifier for every profile-editing action (sharing toggle, details,
/// avatar, password, deactivation) — they all follow the same
/// isUpdating/error shape, and splitting them into separate notifiers would
/// just mean five copies of the same try/catch.
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

  /// Returns true on success so the screen can decide what to do next
  /// (clear a form, show a toast) without inspecting state directly.
  Future<bool> updateDetails({String? username, String? displayName, String? phone}) async {
    state = const ProfileState(isUpdating: true);
    try {
      await _repository.updateProfile(
        username: username,
        displayName: displayName,
        phone: phone,
      );
      await _ref.read(authNotifierProvider.notifier).refreshUser();
      state = const ProfileState();
      return true;
    } catch (e) {
      state = ProfileState(error: e.toString());
      return false;
    }
  }

  Future<bool> uploadAvatar(File image) async {
    state = const ProfileState(isUpdating: true);
    try {
      await _repository.uploadAvatar(image);
      await _ref.read(authNotifierProvider.notifier).refreshUser();
      state = const ProfileState();
      return true;
    } catch (e) {
      state = ProfileState(error: e.toString());
      return false;
    }
  }

  Future<bool> changePassword({required String currentPassword, required String newPassword}) async {
    state = const ProfileState(isUpdating: true);
    try {
      await _repository.changePassword(currentPassword: currentPassword, newPassword: newPassword);
      state = const ProfileState();
      return true;
    } catch (e) {
      state = ProfileState(error: e.toString());
      return false;
    }
  }

  Future<bool> deactivateAccount() async {
    state = const ProfileState(isUpdating: true);
    try {
      await _repository.deactivateAccount();
      state = const ProfileState();
      return true;
    } catch (e) {
      state = ProfileState(error: e.toString());
      return false;
    }
  }
}
