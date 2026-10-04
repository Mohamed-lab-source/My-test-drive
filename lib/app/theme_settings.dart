import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

/// The person's look: light/dark/system mode and a colorful theme.
/// Saved on the phone only (free, no account needed).
class ThemeSettings {
  const ThemeSettings({this.mode = ThemeMode.dark, this.accentId = 'coral'});

  final ThemeMode mode;
  final String accentId;

  AccentTheme get accent => accentById(accentId);

  ThemeSettings copyWith({ThemeMode? mode, String? accentId}) =>
      ThemeSettings(mode: mode ?? this.mode, accentId: accentId ?? this.accentId);
}

/// Loaded once in main() before the app starts, so there's no color flash.
final sharedPrefsProvider = Provider<SharedPreferences?>((_) => null);

class ThemeSettingsNotifier extends Notifier<ThemeSettings> {
  static const _modeKey = 'theme.mode';
  static const _accentKey = 'theme.accent';

  @override
  ThemeSettings build() {
    final prefs = ref.watch(sharedPrefsProvider);
    final mode = switch (prefs?.getString(_modeKey)) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark, // dark by default: easiest to read
    };
    return ThemeSettings(mode: mode, accentId: prefs?.getString(_accentKey) ?? 'coral');
  }

  void setMode(ThemeMode mode) {
    state = state.copyWith(mode: mode);
    ref.read(sharedPrefsProvider)?.setString(_modeKey, mode.name);
  }

  void setAccent(String id) {
    state = state.copyWith(accentId: id);
    ref.read(sharedPrefsProvider)?.setString(_accentKey, id);
  }
}

final themeSettingsProvider =
    NotifierProvider<ThemeSettingsNotifier, ThemeSettings>(ThemeSettingsNotifier.new);
