import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

/// The person's look: light/dark/system mode and a colorful theme.
/// Saved on the phone only (free, no account needed).
class ThemeSettings {
  const ThemeSettings({
    this.mode = ThemeMode.dark,
    this.accentId = 'mono',
    this.textScale = 1.0,
    this.followSun = false,
  });

  /// Light between sunrise and sunset in your city, dark after (calculated).
  final bool followSun;

  final ThemeMode mode;
  final String accentId;

  /// 1.0 = normal, 1.15 = large, 1.3 = extra large.
  final double textScale;

  AccentTheme get accent => accentById(accentId);

  ThemeSettings copyWith({ThemeMode? mode, String? accentId, double? textScale, bool? followSun}) => ThemeSettings(
        mode: mode ?? this.mode,
        accentId: accentId ?? this.accentId,
        textScale: textScale ?? this.textScale,
        followSun: followSun ?? this.followSun,
      );
}

final textScales = <double, String>{1.0: 'Normal', 1.15: 'Large', 1.3: 'Extra large', 1.5: 'Huge'};

/// Loaded once in main() before the app starts, so there's no color flash.
final sharedPrefsProvider = Provider<SharedPreferences?>((_) => null);

class ThemeSettingsNotifier extends Notifier<ThemeSettings> {
  static const _modeKey = 'theme.mode';
  static const _accentKey = 'theme.accent';
  static const _scaleKey = 'theme.textScale';
  static const _sunKey = 'theme.sun';

  @override
  ThemeSettings build() {
    final prefs = ref.watch(sharedPrefsProvider);
    final mode = switch (prefs?.getString(_modeKey)) {
      'light' => ThemeMode.light,
      'system' => ThemeMode.system,
      _ => ThemeMode.dark, // dark by default: easiest to read
    };
    final scale = prefs?.getDouble(_scaleKey) ?? 1.0;
    return ThemeSettings(
      mode: mode,
      accentId: prefs?.getString(_accentKey) ?? 'mono',
      textScale: textScales.containsKey(scale) ? scale : 1.0,
      followSun: prefs?.getBool(_sunKey) ?? false,
    );
  }

  void setFollowSun(bool v) {
    state = state.copyWith(followSun: v);
    ref.read(sharedPrefsProvider)?.setBool(_sunKey, v);
  }

  void setMode(ThemeMode mode) {
    state = state.copyWith(mode: mode);
    ref.read(sharedPrefsProvider)?.setString(_modeKey, mode.name);
  }

  void setTextScale(double scale) {
    state = state.copyWith(textScale: scale);
    ref.read(sharedPrefsProvider)?.setDouble(_scaleKey, scale);
  }

  void setAccent(String id) {
    state = state.copyWith(accentId: id);
    ref.read(sharedPrefsProvider)?.setString(_accentKey, id);
  }
}

final themeSettingsProvider =
    NotifierProvider<ThemeSettingsNotifier, ThemeSettings>(ThemeSettingsNotifier.new);
