import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../data/follows_repository.dart';
import '../domain/follow.dart';

sealed class FollowsState {
  const FollowsState();
}

class FollowsInitial extends FollowsState {
  const FollowsInitial();
}

class FollowsLoading extends FollowsState {
  const FollowsLoading();
}

class FollowsLoaded extends FollowsState {
  const FollowsLoaded(this.pending, {this.actionError});
  final List<Follow> pending;
  final String? actionError;
}

class FollowsError extends FollowsState {
  const FollowsError(this.message);
  final String message;
}

final followsRepositoryProvider = Provider<FollowsRepository>((ref) {
  return FollowsRepository(apiClient: ref.read(apiClientProvider));
});

final followsNotifierProvider = StateNotifierProvider<FollowsNotifier, FollowsState>((ref) {
  return FollowsNotifier(ref.read(followsRepositoryProvider));
});

class FollowsNotifier extends StateNotifier<FollowsState> {
  FollowsNotifier(this._repository) : super(const FollowsInitial());

  final FollowsRepository _repository;

  Future<void> loadPending() async {
    state = const FollowsLoading();
    try {
      final pending = await _repository.getPending();
      state = FollowsLoaded(pending);
    } catch (e) {
      state = FollowsError(e.toString());
    }
  }

  Future<bool> sendFollowRequest(String username) async {
    try {
      await _repository.sendFollowRequest(username);
      return true;
    } catch (e) {
      final current = state;
      if (current is FollowsLoaded) {
        state = FollowsLoaded(current.pending, actionError: e.toString());
      }
      return false;
    }
  }

  Future<void> respond(String followId, {required bool accept}) async {
    try {
      await _repository.respondToFollow(followId, accept: accept);
      await loadPending();
    } catch (e) {
      final current = state;
      if (current is FollowsLoaded) {
        state = FollowsLoaded(current.pending, actionError: e.toString());
      }
    }
  }
}
