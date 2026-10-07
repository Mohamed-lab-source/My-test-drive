import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'i18n.dart';
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

/// Your own named lists of places ("Birthday ideas"), on this phone only.
class PlaceLists extends Notifier<Map<String, List<String>>> {
  static const _key = 'place.lists';

  @override
  Map<String, List<String>> build() {
    final raw = ref.watch(sharedPrefsProvider)?.getString(_key);
    if (raw == null) return const {};
    try {
      final m = jsonDecode(raw) as Map<String, dynamic>;
      return {for (final e in m.entries) e.key: (e.value as List).whereType<String>().toList()};
    } catch (_) {
      return const {};
    }
  }

  void _save(Map<String, List<String>> next) {
    state = next;
    ref.read(sharedPrefsProvider)?.setString(_key, jsonEncode(next));
  }

  void create(String name) {
    final n = name.trim();
    if (n.isEmpty || state.containsKey(n)) return;
    _save({...state, n: const []});
  }

  void toggle(String list, String placeId) {
    final ids = [...?state[list]];
    ids.contains(placeId) ? ids.remove(placeId) : ids.insert(0, placeId);
    _save({...state, list: ids.take(200).toList()});
  }

  void delete(String list) => _save({...state}..remove(list));

  void rename(String from, String to) {
    final n = to.trim();
    if (n.isEmpty || n == from || state.containsKey(n)) return;
    _save({for (final e in state.entries) e.key == from ? n : e.key: e.value});
  }
}

final placeListsProvider =
    NotifierProvider<PlaceLists, Map<String, List<String>>>(PlaceLists.new);

/// A small string → string map saved on the phone (plan ratings, packing lists).
class StringMapPref extends Notifier<Map<String, String>> {
  StringMapPref(this.key);
  final String key;

  @override
  Map<String, String> build() {
    final raw = ref.watch(sharedPrefsProvider)?.getString(key);
    if (raw == null) return const {};
    try {
      return Map<String, String>.from(jsonDecode(raw) as Map);
    } catch (_) {
      return const {};
    }
  }

  void set(String k, String? v) {
    final next = {...state};
    v == null || v.isEmpty ? next.remove(k) : next[k] = v;
    state = next;
    ref.read(sharedPrefsProvider)?.setString(key, jsonEncode(next));
  }
}

/// "How was it?" per plan: 'up' or 'down'.
final planRatingsProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('plan.ratings'));

/// "Things to bring" per plan: lines, a leading "✓ " marks a ticked item.
final bringListsProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('plan.bring'));

/// App settings saved on the phone.
class AppSettings {
  const AppSettings({
    this.startOnExplore = false,
    this.dataSaver = false,
    this.pureBlack = false,
    this.onboarded = false,
    this.seenVersion = '',
    this.lang = 'en',
  });
  final String lang;
  final bool startOnExplore;
  final bool dataSaver;
  final bool pureBlack;
  final bool onboarded;
  final String seenVersion;
}

class AppSettingsNotifier extends Notifier<AppSettings> {
  @override
  AppSettings build() {
    final p = ref.watch(sharedPrefsProvider);
    return AppSettings(
      startOnExplore: p?.getBool('app.startExplore') ?? false,
      dataSaver: p?.getBool('app.dataSaver') ?? false,
      pureBlack: p?.getBool('app.pureBlack') ?? false,
      // No storage (e.g. tests) = don't show the welcome screens.
      onboarded: p == null || (p.getBool('app.onboarded') ?? false),
      seenVersion: p?.getString('app.seenVersion') ?? '',
      lang: appLang,
    );
  }

  void _setBool(String key, bool v) {
    ref.read(sharedPrefsProvider)?.setBool(key, v);
    ref.invalidateSelf();
  }

  /// 'en' or 'ar'. The app rebuilds in the new language.
  void setLanguage(String lang) {
    ref.read(sharedPrefsProvider)?.setString('app.lang', lang);
    appLang = lang;
    ref.invalidateSelf();
  }

  void setStartOnExplore(bool v) => _setBool('app.startExplore', v);
  void setDataSaver(bool v) => _setBool('app.dataSaver', v);
  void setPureBlack(bool v) => _setBool('app.pureBlack', v);
  void finishOnboarding() => _setBool('app.onboarded', true);
  void markSeen(String version) {
    ref.read(sharedPrefsProvider)?.setString('app.seenVersion', version);
    ref.invalidateSelf();
  }
}

final appSettingsProvider =
    NotifierProvider<AppSettingsNotifier, AppSettings>(AppSettingsNotifier.new);

/// When you last opened each group chat (group id → ISO time), for unread dots.
final groupOpenedProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('group.opened'));

/// Your last plan choices (people, vibes, time, stops), so the form remembers.
final lastPlanChoicesProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('plan.last'));

/// People you blocked (uid → name), on this phone. Their chat messages are
/// hidden and their friend requests don't show.
final blockedUsersProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('blocked.users'));

/// Small phone settings: 24-hour clock, haptics, reduce motion, error reports.
class PhoneSettings {
  const PhoneSettings({this.clock24 = true, this.haptics = true, this.reduceMotion = false, this.sendErrors = true});
  final bool clock24;
  final bool haptics;
  final bool reduceMotion;
  final bool sendErrors;
}

class PhoneSettingsNotifier extends Notifier<PhoneSettings> {
  @override
  PhoneSettings build() {
    final p = ref.watch(sharedPrefsProvider);
    return PhoneSettings(
      clock24: p?.getBool('set.clock24') ?? true,
      haptics: p?.getBool('set.haptics') ?? true,
      reduceMotion: p?.getBool('set.reduceMotion') ?? false,
      sendErrors: p?.getBool('set.sendErrors') ?? true,
    );
  }

  void _set(String key, bool v) {
    ref.read(sharedPrefsProvider)?.setBool(key, v);
    ref.invalidateSelf();
  }

  void setClock24(bool v) => _set('set.clock24', v);
  void setHaptics(bool v) => _set('set.haptics', v);
  void setReduceMotion(bool v) => _set('set.reduceMotion', v);
  void setSendErrors(bool v) => _set('set.sendErrors', v);
}

final phoneSettingsProvider =
    NotifierProvider<PhoneSettingsNotifier, PhoneSettings>(PhoneSettingsNotifier.new);

/// Remembered Explore choices (category, sort).
final exploreMemoryProvider =
    NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('explore.memory'));
