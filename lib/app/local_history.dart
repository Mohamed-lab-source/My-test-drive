import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'theme_settings.dart' show sharedPrefsProvider;

/// A short "most recent first" list saved on the phone (recently viewed
/// places, past searches). Never leaves the phone.
class RecentList extends Notifier<List<String>> {
  RecentList(this.key, {this.max = 20});

  final String key;
  final int max;

  @override
  List<String> build() => ref.watch(sharedPrefsProvider)?.getStringList(key) ?? const [];

  void add(String value) {
    final v = value.trim();
    if (v.isEmpty) return;
    state = [v, ...state.where((x) => x != v)].take(max).toList();
    ref.read(sharedPrefsProvider)?.setStringList(key, state);
  }

  void remove(String value) {
    state = state.where((x) => x != value).toList();
    ref.read(sharedPrefsProvider)?.setStringList(key, state);
  }

  void clear() {
    state = const [];
    ref.read(sharedPrefsProvider)?.remove(key);
  }
}

final recentPlacesProvider =
    NotifierProvider<RecentList, List<String>>(() => RecentList('recent.places'));

final searchHistoryProvider =
    NotifierProvider<RecentList, List<String>>(() => RecentList('recent.searches', max: 8));
