import 'package:flutter/material.dart';

/// Khroga's visual system.
///
/// Colors depend on the chosen theme (accent) and light/dark mode, so
/// screens read them with `context.k` (e.g. `context.k.accent`) instead of
/// fixed constants. All colors are picked for strong text contrast.

/// One colorful theme the person can choose.
class AccentTheme {
  const AccentTheme({
    required this.id,
    required this.name,
    required this.light,
    required this.dark,
  });

  final String id;
  final String name;

  /// Accent used in light mode (darker, so white text on it stays readable).
  final Color light;

  /// Accent used in dark mode (brighter, so it stands out on dark surfaces).
  final Color dark;
}

const accentThemes = <AccentTheme>[
  AccentTheme(id: 'coral', name: 'Coral', light: Color(0xFFC93D1B), dark: Color(0xFFFF8A65)),
  AccentTheme(id: 'ocean', name: 'Ocean', light: Color(0xFF1558B0), dark: Color(0xFF6CB4FF)),
  AccentTheme(id: 'emerald', name: 'Emerald', light: Color(0xFF0B7A52), dark: Color(0xFF4FE0A3)),
  AccentTheme(id: 'violet', name: 'Violet', light: Color(0xFF6A2BD6), dark: Color(0xFFB99BFF)),
  AccentTheme(id: 'gold', name: 'Gold', light: Color(0xFF9A5B00), dark: Color(0xFFFFC94D)),
  AccentTheme(id: 'rose', name: 'Rose', light: Color(0xFFBE1858), dark: Color(0xFFFF7EB3)),
];

AccentTheme accentById(String? id) =>
    accentThemes.firstWhere((t) => t.id == id, orElse: () => accentThemes.first);

/// The colors every screen uses, for the current theme and mode.
@immutable
class KPalette extends ThemeExtension<KPalette> {
  const KPalette({
    required this.accent,
    required this.onAccent,
    required this.accentSoft,
    required this.ink,
    required this.inkMuted,
    required this.line,
    required this.surface,
    required this.background,
  });

  final Color accent;

  /// Text/icon color on top of [accent].
  final Color onAccent;

  /// Gentle tinted background (chips, icon tiles, banners).
  final Color accentSoft;
  final Color ink; // main text
  final Color inkMuted; // secondary text (still easy to read)
  final Color line; // borders, dividers
  final Color surface; // cards
  final Color background; // page background

  /// [pureBlack] = true black background (saves battery on OLED screens).
  factory KPalette.of(AccentTheme theme, Brightness brightness, {bool pureBlack = false}) {
    if (brightness == Brightness.dark) {
      final accent = theme.dark;
      final surface = pureBlack ? const Color(0xFF121212) : const Color(0xFF1B1E26);
      return KPalette(
        accent: accent,
        onAccent: const Color(0xFF111318),
        accentSoft: Color.alphaBlend(accent.withValues(alpha: 0.20), surface),
        ink: const Color(0xFFF3F5F9),
        inkMuted: const Color(0xFFB7BECB),
        line: pureBlack ? const Color(0xFF2C2C2C) : const Color(0xFF343A46),
        surface: surface,
        background: pureBlack ? Colors.black : const Color(0xFF111318),
      );
    }
    final accent = theme.light;
    return KPalette(
      accent: accent,
      onAccent: Colors.white,
      accentSoft: Color.alphaBlend(accent.withValues(alpha: 0.12), Colors.white),
      ink: const Color(0xFF14161B),
      inkMuted: const Color(0xFF4A505C),
      line: const Color(0xFFD5D8E0),
      surface: Colors.white,
      background: const Color(0xFFF2F3F6),
    );
  }

  @override
  KPalette copyWith({
    Color? accent,
    Color? onAccent,
    Color? accentSoft,
    Color? ink,
    Color? inkMuted,
    Color? line,
    Color? surface,
    Color? background,
  }) =>
      KPalette(
        accent: accent ?? this.accent,
        onAccent: onAccent ?? this.onAccent,
        accentSoft: accentSoft ?? this.accentSoft,
        ink: ink ?? this.ink,
        inkMuted: inkMuted ?? this.inkMuted,
        line: line ?? this.line,
        surface: surface ?? this.surface,
        background: background ?? this.background,
      );

  @override
  KPalette lerp(KPalette? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return KPalette(
      accent: l(accent, other.accent),
      onAccent: l(onAccent, other.onAccent),
      accentSoft: l(accentSoft, other.accentSoft),
      ink: l(ink, other.ink),
      inkMuted: l(inkMuted, other.inkMuted),
      line: l(line, other.line),
      surface: l(surface, other.surface),
      background: l(background, other.background),
    );
  }
}

extension KPaletteX on BuildContext {
  /// The current theme's colors, e.g. `context.k.accent`.
  KPalette get k => Theme.of(this).extension<KPalette>()!;
}

class KSpace {
  KSpace._();
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

class KRadius {
  KRadius._();
  static const card = 20.0;
  static const field = 14.0;
}

ThemeData buildTheme({
  AccentTheme accent = const AccentTheme(
      id: 'coral', name: 'Coral', light: Color(0xFFC93D1B), dark: Color(0xFFFF8A65)),
  Brightness brightness = Brightness.dark,
  bool pureBlack = false,
}) {
  final p = KPalette.of(accent, brightness, pureBlack: pureBlack);
  final scheme = ColorScheme.fromSeed(
    seedColor: p.accent,
    brightness: brightness,
  ).copyWith(
    primary: p.accent,
    onPrimary: p.onAccent,
    surface: p.surface,
    onSurface: p.ink,
    onSurfaceVariant: p.inkMuted,
    outline: p.line,
    outlineVariant: p.line,
  );

  const pill = StadiumBorder(); // pill shapes always use StadiumBorder

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    extensions: [p],
    scaffoldBackgroundColor: p.background,
    appBarTheme: AppBarTheme(
      backgroundColor: p.background,
      foregroundColor: p.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(color: p.ink, fontSize: 22, fontWeight: FontWeight.w700),
    ),
    textTheme: TextTheme(
      headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: p.ink),
      titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: p.ink),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: p.ink),
      bodyLarge: TextStyle(fontSize: 16, color: p.ink),
      bodyMedium: TextStyle(fontSize: 15, color: p.ink),
      bodySmall: TextStyle(fontSize: 13, color: p.inkMuted),
    ),
    iconTheme: IconThemeData(color: p.ink),
    listTileTheme: ListTileThemeData(
      textColor: p.ink,
      iconColor: p.inkMuted,
      subtitleTextStyle: TextStyle(color: p.inkMuted, fontSize: 14),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KRadius.card),
        side: BorderSide(color: p.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.accent,
        foregroundColor: p.onAccent,
        shape: pill,
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.symmetric(horizontal: KSpace.lg),
        textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: pill,
        minimumSize: const Size(0, 48),
        foregroundColor: p.ink,
        side: BorderSide(color: p.line),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(shape: pill, foregroundColor: p.accent),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.accent,
      foregroundColor: p.onAccent,
    ),
    chipTheme: ChipThemeData(
      shape: pill,
      side: BorderSide(color: p.line),
      backgroundColor: p.surface,
      selectedColor: p.accentSoft,
      labelStyle: TextStyle(fontWeight: FontWeight.w600, color: p.ink),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        backgroundColor: p.surface,
        foregroundColor: p.ink,
        selectedBackgroundColor: p.accentSoft,
        selectedForegroundColor: p.ink,
        side: BorderSide(color: p.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      hintStyle: TextStyle(color: p.inkMuted),
      prefixIconColor: p.inkMuted,
      suffixIconColor: p.inkMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: BorderSide(color: p.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: BorderSide(color: p.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: BorderSide(color: p.accent, width: 1.5),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.accentSoft,
      surfaceTintColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? p.accent : p.inkMuted,
          )),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: states.contains(WidgetState.selected) ? p.ink : p.inkMuted,
          )),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
    ),
    popupMenuTheme: PopupMenuThemeData(color: p.surface, surfaceTintColor: Colors.transparent),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: DividerThemeData(color: p.line, space: 1),
  );
}
