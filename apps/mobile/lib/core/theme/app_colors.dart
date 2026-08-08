import 'package:flutter/material.dart';

/// Brand palette. Kept as named constants (rather than inlined hexes per
/// screen) so the SOS/danger red stays exclusively reserved for danger
/// states — never reused as a generic accent — and every screen pulls
/// colors from one source instead of hardcoding its own.
class AppColors {
  AppColors._();

  static const seed = Color(0xFF6B4EFF);
  static const gradientStart = Color(0xFF6B4EFF);
  static const gradientEnd = Color(0xFFF3F0FF);

  /// Reserved for SOS/danger UI only (trigger button, active-SOS banner,
  /// circle-member SOS alert). Never reused as a general accent color.
  static const danger = Color(0xFFE53935);

  /// "Other circle member" map marker color — deliberately distinct from
  /// [danger] so map markers are never mistaken for an SOS state.
  static const memberMarker = Color(0xFF2E7D6B);
  static const selfMarker = Color(0xFF6B4EFF);

  static const offline = Color(0xFFFFA726);
}
