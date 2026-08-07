/// Motion-adaptive sampling (accelerometer-based: high-frequency GPS while
/// moving, drop to significant-change updates while stationary) is deferred
/// past this sprint — [LocationService] uses a fixed balanced-power
/// interval instead (see docs/08-flutter-app-structure.md, which allows
/// this as a Sprint 5+ refinement).
///
/// This stub exists so the intended integration point is visible: a real
/// implementation would expose a `Stream<MotionState>` that
/// `LocationService` subscribes to in order to vary its sampling interval.
enum MotionState { stationary, moving, unknown }

class MotionDetector {
  Stream<MotionState> get motionState => const Stream<MotionState>.empty();

  void start() {}

  void stop() {}
}
