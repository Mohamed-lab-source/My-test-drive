import 'package:flutter/material.dart';

/// Khroga's visual system: clean, light, one bold accent.
///
/// All colors live here so a future redesign only touches this file.
/// Nothing here is mutable, so every widget can safely use `const`.
class KColors {
  KColors._();

  static const accent = Color(0xFFFF5A36); // warm coral-orange
  static const accentSoft = Color(0xFFFFEDE8);
  static const ink = Color(0xFF16181D); // main text
  static const inkMuted = Color(0xFF6B7080); // secondary text
  static const line = Color(0xFFE8E9EE); // borders, dividers
  static const surface = Color(0xFFFFFFFF); // cards
  static const background = Color(0xFFF7F7F9); // page background
  static const success = Color(0xFF1E9E6A);
  static const warning = Color(0xFFE8A317);
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

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: KColors.accent,
    primary: KColors.accent,
    onPrimary: Colors.white,
    surface: KColors.surface,
    onSurface: KColors.ink,
    brightness: Brightness.light,
  );

  const pill = StadiumBorder(); // pill shapes always use StadiumBorder

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: KColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: KColors.background,
      foregroundColor: KColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: KColors.ink,
        fontSize: 22,
        fontWeight: FontWeight.w700,
      ),
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
          fontSize: 28, fontWeight: FontWeight.w800, color: KColors.ink),
      titleLarge: TextStyle(
          fontSize: 20, fontWeight: FontWeight.w700, color: KColors.ink),
      titleMedium: TextStyle(
          fontSize: 16, fontWeight: FontWeight.w600, color: KColors.ink),
      bodyLarge: TextStyle(fontSize: 16, color: KColors.ink),
      bodyMedium: TextStyle(fontSize: 14, color: KColors.ink),
      bodySmall: TextStyle(fontSize: 12, color: KColors.inkMuted),
    ),
    cardTheme: CardThemeData(
      color: KColors.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KRadius.card),
        side: const BorderSide(color: KColors.line),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
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
        foregroundColor: KColors.ink,
        side: const BorderSide(color: KColors.line),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(shape: pill),
    ),
    chipTheme: ChipThemeData(
      shape: pill,
      side: const BorderSide(color: KColors.line),
      backgroundColor: KColors.surface,
      selectedColor: KColors.accentSoft,
      labelStyle: const TextStyle(fontWeight: FontWeight.w600),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: KColors.surface,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: const BorderSide(color: KColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: const BorderSide(color: KColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(KRadius.field),
        borderSide: const BorderSide(color: KColors.accent, width: 1.5),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: KColors.surface,
      indicatorColor: KColors.accentSoft,
      surfaceTintColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    dividerTheme: const DividerThemeData(color: KColors.line, space: 1),
  );
}
