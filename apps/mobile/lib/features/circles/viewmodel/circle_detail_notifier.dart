import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/circles_repository.dart';
import '../domain/circle.dart';
import 'circles_notifier.dart';

sealed class CircleDetailState {
  const CircleDetailState();
}

class CircleDetailInitial extends CircleDetailState {
  const CircleDetailInitial();
}

class CircleDetailLoading extends CircleDetailState {
  const CircleDetailLoading();
}

class CircleDetailLoaded extends CircleDetailState {
  const CircleDetailLoaded(this.circle, {this.actionError});
  final CircleWithMembers circle;
  final String? actionError;
}

class CircleDetailError extends CircleDetailState {
  const CircleDetailError(this.message);
  final String message;
}

final circleDetailNotifierProvider = StateNotifierProvider.family<CircleDetailNotifier,
    CircleDetailState, String>((ref, circleId) {
  return CircleDetailNotifier(ref.read(circlesRepositoryProvider), circleId);
});

class CircleDetailNotifier extends StateNotifier<CircleDetailState> {
  CircleDetailNotifier(this._repository, this._circleId) : super(const CircleDetailInitial());

  final CirclesRepository _repository;
  final String _circleId;

  Future<void> load() async {
    state = const CircleDetailLoading();
    try {
      final circle = await _repository.getCircle(_circleId);
      state = CircleDetailLoaded(circle);
    } catch (e) {
      state = CircleDetailError(e.toString());
    }
  }

  Future<bool> addMember(String username) async {
    try {
      await _repository.addMember(_circleId, username);
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is CircleDetailLoaded) {
        state = CircleDetailLoaded(current.circle, actionError: e.toString());
      }
      return false;
    }
  }

  Future<bool> removeMember(String userId) async {
    try {
      await _repository.removeMember(_circleId, userId);
      await load();
      return true;
    } catch (e) {
      final current = state;
      if (current is CircleDetailLoaded) {
        state = CircleDetailLoaded(current.circle, actionError: e.toString());
      }
      return false;
    }
  }

  Future<bool> deleteCircle() async {
    try {
      await _repository.deleteCircle(_circleId);
      return true;
    } catch (_) {
      return false;
    }
  }
}
