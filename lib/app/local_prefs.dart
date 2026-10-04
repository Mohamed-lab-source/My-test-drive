import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'theme_settings.dart' show sharedPrefsProvider;

/// Your own 1–5 star ratings, kept on this phone only. They're never shown
/// to anyone else and never mixed with place facts.
class MyRatings extends Notifier<Map<String, int>> {
  static const _key = 'my.ratings';

  @override
  Map<String, int> build() {
    final raw = ref.watch(sharedPrefsProvider)?.getStringList(_key) ?? const [];
    return {
      for (final e in raw)
        if (e.contains(':') && int.tryParse(e.split(':').last) != null)
          e.substring(0, e.lastIndexOf(':')): int.parse(e.split(':').last),
    };
  }

  void set(String placeId, int? stars) {
    final next = {...state};
    stars == null || stars == 0 ? next.remove(placeId) : next[placeId] = stars.clamp(1, 5);
    state = next;
    ref.read(sharedPrefsProvider)?.setStringList(
        _key, [for (final e in next.entries) '${e.key}:${e.value}']);
  }

  void clear() {
    state = const {};
    ref.read(sharedPrefsProvider)?.remove(_key);
  }
}

final myRatingsProvider = NotifierProvider<MyRatings, Map<String, int>>(MyRatings.new);

/// Ticked-off plan stops ("planId:placeId"), kept on this phone only.
class PlanChecklist extends Notifier<Set<String>> {
  static const _key = 'plan.done';

  @override
  Set<String> build() =>
      (ref.watch(sharedPrefsProvider)?.getStringList(_key) ?? const []).toSet();

  static String keyFor(String planId, String placeId) => '$planId:$placeId';

  void toggle(String planId, String placeId) {
    final k = keyFor(planId, placeId);
    final next = {...state};
    next.contains(k) ? next.remove(k) : next.add(k);
    // Keep the list short: the newest 300 ticks are plenty.
    state = next.length > 300 ? next.skip(next.length - 300).toSet() : next;
    ref.read(sharedPrefsProvider)?.setStringList(_key, state.toList());
  }

  void clear() {
    state = const {};
    ref.read(sharedPrefsProvider)?.remove(_key);
  }
}

final planChecklistProvider =
    NotifierProvider<PlanChecklist, Set<String>>(PlanChecklist.new);
