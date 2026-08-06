import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../auth/viewmodel/auth_notifier.dart';
import '../data/circles_repository.dart';
import '../domain/circle.dart';

sealed class CirclesState {
  const CirclesState();
}

class CirclesInitial extends CirclesState {
  const CirclesInitial();
}

class CirclesLoading extends CirclesState {
  const CirclesLoading();
}

class CirclesLoaded extends CirclesState {
  const CirclesLoaded(this.circles);
  final List<Circle> circles;
}

class CirclesError extends CirclesState {
  const CirclesError(this.message);
  final String message;
}

final circlesRepositoryProvider = Provider<CirclesRepository>((ref) {
  return CirclesRepository(apiClient: ref.read(apiClientProvider));
});

final circlesNotifierProvider = StateNotifierProvider<CirclesNotifier, CirclesState>((ref) {
  return CirclesNotifier(ref.read(circlesRepositoryProvider));
});

class CirclesNotifier extends StateNotifier<CirclesState> {
  CirclesNotifier(this._repository) : super(const CirclesInitial());

  final CirclesRepository _repository;

  Future<void> load() async {
    state = const CirclesLoading();
    try {
      final circles = await _repository.listCircles();
      state = CirclesLoaded(circles);
    } catch (e) {
      state = CirclesError(e.toString());
    }
  }

  Future<bool> createCircle(String name) async {
    try {
      await _repository.createCircle(name);
      await load();
      return true;
    } catch (_) {
      return false;
    }
  }
}
