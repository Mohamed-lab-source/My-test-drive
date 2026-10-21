import 'package:flutter/material.dart';

/// Khroga's visual system.
///
/// Colors depend on the chosen theme (accent) and light/dark mode, so
/// screens read them with `context.k` (e.g. `context.k.accent`) instead of
/// fixed constants. All colors are picked for strong text contrast.

/// One colorful theme the person can choose. Each has a pair of colors that
/// blend into a gradient (buttons, headers, the nav bar's selected item).
class AccentTheme {
  const AccentTheme({
    required this.id,
    required this.name,
    required this.light,
    required this.dark,
    required this.light2,
    required this.dark2,
  });

  final String id;
  final String name;

  /// Accent used in light mode (darker, so white text on it stays readable).
  final Color light;

  /// Accent used in dark mode (brighter, so it stands out on dark surfaces).
  final Color dark;

  /// The gradient partners of [light] and [dark] (same readability rules).
  final Color light2;
  final Color dark2;
}

const accentThemes = <AccentTheme>[
  AccentTheme(
      id: 'coral', name: 'Coral',
      light: Color(0xFFC93D1B), light2: Color(0xFFB8174F),
      dark: Color(0xFFFF8A65), dark2: Color(0xFFFF7AA8)),
  AccentTheme(
      id: 'ocean', name: 'Ocean',
      light: Color(0xFF1558B0), light2: Color(0xFF0B6E99),
      dark: Color(0xFF6CB4FF), dark2: Color(0xFF6FE0F5)),
  AccentTheme(
      id: 'emerald', name: 'Emerald',
      light: Color(0xFF0B7A52), light2: Color(0xFF0A6E7A),
      dark: Color(0xFF4FE0A3), dark2: Color(0xFF6FD8E8)),
  AccentTheme(
      id: 'violet', name: 'Violet',
      light: Color(0xFF6A2BD6), light2: Color(0xFFA3209A),
      dark: Color(0xFFB99BFF), dark2: Color(0xFFF29BE8)),
  AccentTheme(
      id: 'gold', name: 'Gold',
      light: Color(0xFF9A5B00), light2: Color(0xFFB33A12),
      dark: Color(0xFFFFC94D), dark2: Color(0xFFFF9E5E)),
  AccentTheme(
      id: 'rose', name: 'Rose',
      light: Color(0xFFBE1858), light2: Color(0xFF8A2BC2),
      dark: Color(0xFFFF7EB3), dark2: Color(0xFFC9A2FF)),
  AccentTheme(
      id: 'teal', name: 'Teal',
      light: Color(0xFF00695C), light2: Color(0xFF1559A8),
      dark: Color(0xFF4DD0C1), dark2: Color(0xFF86BDFF)),
  AccentTheme(
      id: 'indigo', name: 'Indigo',
      light: Color(0xFF3949AB), light2: Color(0xFF7A2BC2),
      dark: Color(0xFFA5AFFF), dark2: Color(0xFFE0A8FF)),
];

AccentTheme accentById(String? id) =>
    accentThemes.firstWhere((t) => t.id == id, orElse: () => accentThemes.first);

/// The colors every screen uses, for the current theme and mode.
@immutable
class KPalette extends ThemeExtension<KPalette> {
  const KPalette({
    required this.accent,
    required this.accent2,
    required this.onAccent,
    required this.accentSoft,
    required this.ink,
    required this.inkMuted,
    required this.line,
    required this.surface,
    required this.surfaceHigh,
    required this.background,
    required this.heroStart,
    required this.heroEnd,
    required this.onHero,
    required this.shadow,
    required this.isDark,
  });

  final Color accent;

  /// Gradient partner of [accent] ([onAccent] text reads on both).
  final Color accent2;

  /// Text/icon color on top of [accent].
  final Color onAccent;

  /// Gentle tinted background (chips, icon tiles, banners).
  final Color accentSoft;
  final Color ink; // main text
  final Color inkMuted; // secondary text (still easy to read)
  final Color line; // borders, dividers
  final Color surface; // cards
  final Color surfaceHigh; // raised things on cards (fields, the nav bar)
  final Color background; // page background

  /// Big header cards: a gradient from [heroStart] to [heroEnd], with
  /// [onHero] text (bold in light mode, deep and glowing in dark mode).
  final Color heroStart;
  final Color heroEnd;
  final Color onHero;

  /// Soft shadow color for floating things.
  final Color shadow;
  final bool isDark;

  LinearGradient get accentGradient => LinearGradient(
        begin: AlignmentDirectional.topStart,
        end: AlignmentDirectional.bottomEnd,
        colors: [accent, accent2],
      );

  LinearGradient get heroGradient => LinearGradient(
        begin: AlignmentDirectional.topStart,
        end: AlignmentDirectional.bottomEnd,
        colors: [heroStart, heroEnd],
      );

  /// A soft, wide shadow (lighter in dark mode, where shadows barely show).
  List<BoxShadow> get softShadow => [
        BoxShadow(color: shadow, blurRadius: 24, offset: const Offset(0, 8)),
      ];

  /// [pureBlack] = true black background (saves battery on OLED screens).
  factory KPalette.of(AccentTheme theme, Brightness brightness, {bool pureBlack = false}) {
    if (brightness == Brightness.dark) {
      final accent = theme.dark;
      final surface = pureBlack ? const Color(0xFF121212) : const Color(0xFF171A22);
      return KPalette(
        accent: accent,
        accent2: theme.dark2,
        onAccent: const Color(0xFF111318),
        accentSoft: Color.alphaBlend(accent.withValues(alpha: 0.20), surface),
        ink: const Color(0xFFF4F6FA),
        inkMuted: const Color(0xFFB3BAC7),
        line: pureBlack ? const Color(0xFF2C2C2C) : const Color(0xFF2A2F3A),
        surface: surface,
        surfaceHigh: pureBlack ? const Color(0xFF1C1C1C) : const Color(0xFF1F232D),
        background: pureBlack ? Colors.black : const Color(0xFF0D0F14),
        heroStart: Color.alphaBlend(accent.withValues(alpha: 0.36), surface),
        heroEnd: Color.alphaBlend(theme.dark2.withValues(alpha: 0.24), surface),
        onHero: const Color(0xFFF4F6FA),
        shadow: Colors.black.withValues(alpha: 0.35),
        isDark: true,
      );
    }
    final accent = theme.light;
    return KPalette(
      accent: accent,
      accent2: theme.light2,
      onAccent: Colors.white,
      accentSoft: Color.alphaBlend(accent.withValues(alpha: 0.12), Colors.white),
      ink: const Color(0xFF15171C),
      inkMuted: const Color(0xFF4E5461),
      line: const Color(0xFFE3E0DA),
      surface: Colors.white,
      surfaceHigh: const Color(0xFFF0EEEA),
      background: const Color(0xFFF6F4F1),
      heroStart: accent,
      heroEnd: theme.light2,
      onHero: Colors.white,
      shadow: const Color(0xFF2B2118).withValues(alpha: 0.08),
      isDark: false,
    );
  }

  @override
  KPalette copyWith({
    Color? accent,
    Color? accent2,
    Color? onAccent,
    Color? accentSoft,
    Color? ink,
    Color? inkMuted,
    Color? line,
    Color? surface,
    Color? surfaceHigh,
    Color? background,
    Color? heroStart,
    Color? heroEnd,
    Color? onHero,
    Color? shadow,
    bool? isDark,
  }) =>
      KPalette(
        accent: accent ?? this.accent,
        accent2: accent2 ?? this.accent2,
        onAccent: onAccent ?? this.onAccent,
        accentSoft: accentSoft ?? this.accentSoft,
        ink: ink ?? this.ink,
        inkMuted: inkMuted ?? this.inkMuted,
        line: line ?? this.line,
        surface: surface ?? this.surface,
        surfaceHigh: surfaceHigh ?? this.surfaceHigh,
        background: background ?? this.background,
        heroStart: heroStart ?? this.heroStart,
        heroEnd: heroEnd ?? this.heroEnd,
        onHero: onHero ?? this.onHero,
        shadow: shadow ?? this.shadow,
        isDark: isDark ?? this.isDark,
      );

  @override
  KPalette lerp(KPalette? other, double t) {
    if (other == null) return this;
    Color l(Color a, Color b) => Color.lerp(a, b, t)!;
    return KPalette(
      accent: l(accent, other.accent),
      accent2: l(accent2, other.accent2),
      onAccent: l(onAccent, other.onAccent),
      accentSoft: l(accentSoft, other.accentSoft),
      ink: l(ink, other.ink),
      inkMuted: l(inkMuted, other.inkMuted),
      line: l(line, other.line),
      surface: l(surface, other.surface),
      surfaceHigh: l(surfaceHigh, other.surfaceHigh),
      background: l(background, other.background),
      heroStart: l(heroStart, other.heroStart),
      heroEnd: l(heroEnd, other.heroEnd),
      onHero: l(onHero, other.onHero),
      shadow: l(shadow, other.shadow),
      isDark: t < 0.5 ? isDark : other.isDark,
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
  static const card = 22.0;
  static const field = 16.0;
  static const sheet = 28.0;
}

/// Font families (bundled, free: SIL Open Font License). Alexandria for big
/// titles, Readex Pro for everything else; both draw Arabic and Latin.
class KFont {
  KFont._();
  static const display = 'Alexandria';
  static const body = 'ReadexPro';
}

/// Shared animation timings, so things feel like one app.
class KMotion {
  KMotion._();
  static const fast = Duration(milliseconds: 160);
  static const medium = Duration(milliseconds: 280);
  static const slow = Duration(milliseconds: 520);
  static const curve = Curves.easeOutCubic;
}

ThemeData buildTheme({
  AccentTheme accent = const AccentTheme(
      id: 'coral',
      name: 'Coral',
      light: Color(0xFFC93D1B),
      dark: Color(0xFFFF8A65),
      light2: Color(0xFFB8174F),
      dark2: Color(0xFFFF7AA8)),
  Brightness brightness = Brightness.dark,
  bool pureBlack = false,
}) {
  final p = KPalette.of(accent, brightness, pureBlack: pureBlack);
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: p.accent,
    brightness: brightness,
  ).copyWith(
    primary: p.accent,
    onPrimary: p.onAccent,
    secondary: p.accent2,
    onSecondary: p.onAccent,
    surface: p.surface,
    onSurface: p.ink,
    onSurfaceVariant: p.inkMuted,
    surfaceContainerLowest: p.background,
    surfaceContainerLow: p.surface,
    surfaceContainer: p.surface,
    surfaceContainerHigh: p.surfaceHigh,
    surfaceContainerHighest: p.surfaceHigh,
    outline: p.line,
    outlineVariant: p.line,
  );

  const pill = StadiumBorder(); // pill shapes always use StadiumBorder
  TextStyle display(double size, FontWeight w, {double height = 1.2}) =>
      TextStyle(fontFamily: KFont.display, fontSize: size, fontWeight: w, height: height, color: p.ink);
  TextStyle body(double size, FontWeight w, Color c, {double height = 1.4}) =>
      TextStyle(fontFamily: KFont.body, fontSize: size, fontWeight: w, height: height, color: c);
  // The snack bar is the opposite of the page, so it always stands out.
  final snackBg = dark ? const Color(0xFFF4F6FA) : const Color(0xFF1B1E26);
  final snackFg = dark ? const Color(0xFF15171C) : const Color(0xFFF4F6FA);
  final snackAction = dark ? accent.light : accent.dark;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme,
    extensions: [p],
    fontFamily: KFont.body,
    scaffoldBackgroundColor: p.background,
    canvasColor: p.background,
    splashFactory: InkSparkle.splashFactory,
    // Android's newer back gesture shows a preview of the screen behind.
    pageTransitionsTheme: const PageTransitionsTheme(builders: {
      TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
    }),
    appBarTheme: AppBarTheme(
      backgroundColor: p.background,
      foregroundColor: p.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      surfaceTintColor: Colors.transparent,
      centerTitle: false,
      titleTextStyle: display(21, FontWeight.w700),
    ),
    textTheme: TextTheme(
      displaySmall: display(34, FontWeight.w800, height: 1.12),
      headlineLarge: display(30, FontWeight.w800, height: 1.15),
      headlineMedium: display(27, FontWeight.w800, height: 1.18),
      headlineSmall: display(23, FontWeight.w700),
      titleLarge: display(19, FontWeight.w700, height: 1.25),
      titleMedium: body(16, FontWeight.w600, p.ink, height: 1.3),
      titleSmall: body(14, FontWeight.w600, p.ink, height: 1.3),
      bodyLarge: body(16, FontWeight.w400, p.ink, height: 1.5),
      bodyMedium: body(15, FontWeight.w400, p.ink, height: 1.45),
      bodySmall: body(13, FontWeight.w400, p.inkMuted, height: 1.4),
      labelLarge: body(15, FontWeight.w600, p.ink, height: 1.2),
      labelMedium: body(13, FontWeight.w600, p.ink, height: 1.2),
      labelSmall: body(11.5, FontWeight.w600, p.inkMuted, height: 1.2),
    ),
    iconTheme: IconThemeData(color: p.ink),
    listTileTheme: ListTileThemeData(
      textColor: p.ink,
      iconColor: p.inkMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: KSpace.md),
      minVerticalPadding: 10,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KRadius.field)),
      titleTextStyle: body(15.5, FontWeight.w500, p.ink, height: 1.3),
      subtitleTextStyle: body(13.5, FontWeight.w400, p.inkMuted, height: 1.35),
    ),
    cardTheme: CardThemeData(
      color: p.surface,
      elevation: dark ? 0 : 2,
      shadowColor: p.shadow,
      surfaceTintColor: Colors.transparent,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(KRadius.card),
        side: BorderSide(color: dark ? p.line : p.line.withValues(alpha: 0.6)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: p.accent,
        foregroundColor: p.onAccent,
        disabledBackgroundColor: p.line,
        disabledForegroundColor: p.inkMuted,
        shape: pill,
        elevation: 0,
        minimumSize: const Size(0, 54),
        padding: const EdgeInsets.symmetric(horizontal: KSpace.lg),
        textStyle: body(16, FontWeight.w700, p.onAccent),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: p.surfaceHigh,
        foregroundColor: p.ink,
        shape: pill,
        elevation: 0,
        minimumSize: const Size(0, 48),
        textStyle: body(15, FontWeight.w600, p.ink),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        shape: pill,
        minimumSize: const Size(0, 50),
        foregroundColor: p.ink,
        side: BorderSide(color: p.line, width: 1.2),
        textStyle: body(15, FontWeight.w600, p.ink),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        shape: pill,
        foregroundColor: p.accent,
        textStyle: body(14.5, FontWeight.w600, p.accent),
      ),
    ),
    iconButtonTheme: IconButtonThemeData(
      style: IconButton.styleFrom(foregroundColor: p.ink, highlightColor: p.accentSoft),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: p.accent,
      foregroundColor: p.onAccent,
      elevation: 3,
      highlightElevation: 6,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      extendedTextStyle: body(15, FontWeight.w700, p.onAccent),
    ),
    chipTheme: ChipThemeData(
      shape: pill,
      side: BorderSide(color: p.line),
      backgroundColor: p.surface,
      selectedColor: p.accentSoft,
      secondarySelectedColor: p.accentSoft,
      labelStyle: body(14, FontWeight.w600, p.ink, height: 1.2),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      pressElevation: 0,
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: SegmentedButton.styleFrom(
        backgroundColor: p.surface,
        foregroundColor: p.ink,
        selectedBackgroundColor: p.accentSoft,
        selectedForegroundColor: p.ink,
        side: BorderSide(color: p.line),
        textStyle: body(14, FontWeight.w600, p.ink),
      ),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.onAccent : p.inkMuted),
      trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.accent : p.surfaceHigh),
      trackOutlineColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.accent : p.line),
    ),
    checkboxTheme: CheckboxThemeData(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.accent : Colors.transparent),
      checkColor: WidgetStatePropertyAll(p.onAccent),
      side: BorderSide(color: p.inkMuted, width: 1.6),
    ),
    radioTheme: RadioThemeData(
      fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? p.accent : p.inkMuted),
    ),
    sliderTheme: SliderThemeData(
      activeTrackColor: p.accent,
      inactiveTrackColor: p.surfaceHigh,
      thumbColor: p.accent,
      overlayColor: p.accent.withValues(alpha: 0.14),
      valueIndicatorColor: p.accent,
      valueIndicatorTextStyle: body(13, FontWeight.w700, p.onAccent),
      trackHeight: 6,
    ),
    progressIndicatorTheme: ProgressIndicatorThemeData(
      color: p.accent,
      linearTrackColor: p.surfaceHigh,
      circularTrackColor: Colors.transparent,
      linearMinHeight: 6,
      borderRadius: BorderRadius.circular(6),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: p.ink,
      unselectedLabelColor: p.inkMuted,
      indicatorColor: p.accent,
      indicatorSize: TabBarIndicatorSize.label,
      dividerColor: Colors.transparent,
      labelStyle: body(14.5, FontWeight.w700, p.ink),
      unselectedLabelStyle: body(14.5, FontWeight.w500, p.inkMuted),
    ),
    expansionTileTheme: ExpansionTileThemeData(
      shape: const RoundedRectangleBorder(side: BorderSide.none),
      collapsedShape: const RoundedRectangleBorder(side: BorderSide.none),
      iconColor: p.accent,
      collapsedIconColor: p.inkMuted,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: p.surface,
      hintStyle: body(15, FontWeight.w400, p.inkMuted),
      labelStyle: body(15, FontWeight.w400, p.inkMuted),
      prefixIconColor: p.inkMuted,
      suffixIconColor: p.inkMuted,
      contentPadding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: 15),
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
        borderSide: BorderSide(color: p.accent, width: 1.8),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: p.surface,
      indicatorColor: p.accentSoft,
      surfaceTintColor: Colors.transparent,
      iconTheme: WidgetStateProperty.resolveWith((states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? p.accent : p.inkMuted,
          )),
      labelTextStyle: WidgetStateProperty.resolveWith((states) => body(
            12,
            FontWeight.w600,
            states.contains(WidgetState.selected) ? p.ink : p.inkMuted,
          )),
    ),
    bottomSheetTheme: BottomSheetThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      showDragHandle: true,
      dragHandleColor: p.line,
      dragHandleSize: const Size(44, 5),
      elevation: 8,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(KRadius.sheet)),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KRadius.sheet)),
      titleTextStyle: display(20, FontWeight.w700),
      contentTextStyle: body(15, FontWeight.w400, p.ink),
    ),
    datePickerTheme: DatePickerThemeData(
      backgroundColor: p.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KRadius.sheet)),
      headerHeadlineStyle: display(26, FontWeight.w700),
    ),
    timePickerTheme: TimePickerThemeData(
      backgroundColor: p.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(KRadius.sheet)),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: p.surfaceHigh,
      surfaceTintColor: Colors.transparent,
      elevation: 10,
      shadowColor: p.shadow,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: p.line),
      ),
      textStyle: body(15, FontWeight.w500, p.ink),
    ),
    menuTheme: MenuThemeData(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(p.surfaceHigh),
        surfaceTintColor: const WidgetStatePropertyAll(Colors.transparent),
        shape: WidgetStatePropertyAll(RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
      ),
    ),
    tooltipTheme: TooltipThemeData(
      decoration: BoxDecoration(color: snackBg, borderRadius: BorderRadius.circular(10)),
      textStyle: body(13, FontWeight.w500, snackFg),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: snackBg,
      contentTextStyle: body(14.5, FontWeight.w500, snackFg),
      actionTextColor: snackAction,
      elevation: 6,
      insetPadding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.md),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    badgeTheme: BadgeThemeData(backgroundColor: p.accent, textColor: p.onAccent),
    dividerTheme: DividerThemeData(color: p.line, space: 1, thickness: 1),
  );
}
