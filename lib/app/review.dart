import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_review/in_app_review.dart';

import 'theme_settings.dart' show sharedPrefsProvider;

/// Asks for a Play Store rating only after a few happy moments (a plan you
/// loved, a saved plan, joining friends), at most once every 90 days.
/// Google decides whether the box really shows; it never interrupts twice.
bool shouldAskForReview({required int moments, DateTime? lastAsked, required DateTime now}) =>
    moments >= 3 && (lastAsked == null || now.difference(lastAsked).inDays >= 90);

Future<void> happyMoment(WidgetRef ref) async {
  final prefs = ref.read(sharedPrefsProvider);
  if (prefs == null) return;
  final moments = (prefs.getInt('review.moments') ?? 0) + 1;
  await prefs.setInt('review.moments', moments);
  final last = DateTime.tryParse(prefs.getString('review.asked') ?? '');
  final now = DateTime.now();
  if (!shouldAskForReview(moments: moments, lastAsked: last, now: now)) return;
  try {
    final review = InAppReview.instance;
    if (!await review.isAvailable()) return;
    await prefs.setString('review.asked', now.toIso8601String());
    await prefs.setInt('review.moments', 0);
    await review.requestReview();
  } catch (_) {
    // Not installed from the Play Store, or offline: nothing to do.
  }
}

/// "Rate Khroga" in Profile: opens the Play Store page.
Future<void> openStoreListing() async {
  try {
    await InAppReview.instance.openStoreListing();
  } catch (_) {}
}
