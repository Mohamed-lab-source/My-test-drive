import 'package:flutter/material.dart';

/// Masar colors (same as the design canvas).
class AppColors {
  static const ground = Color(0xFFF5F3EE);
  static const ink = Color(0xFF15213B);
  static const muted = Color(0xFF5B6478);
  static const blue = Color(0xFF2A55E5);
  static const blueSoft = Color(0xFFE8EDFC);
  static const blueDark = Color(0xFF1C3FB8);
  static const amber = Color(0xFFF2A93B);
  static const amberSoft = Color(0xFFFCEBCB);
  static const amberInk = Color(0xFF6B4508);
  static const line = Color(0xFFE4E0D7);
  static const white = Color(0xFFFFFFFF);
  static const whiteFaded = Color(0x47FFFFFF);
}

ThemeData buildTheme() {
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      primary: AppColors.blue,
      surface: AppColors.ground,
    ),
    scaffoldBackgroundColor: AppColors.ground,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.ground,
      foregroundColor: AppColors.ink,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
  );
}

/// White rounded box used all over the app.
class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.color = AppColors.white});

  final Widget child;
  final EdgeInsets padding;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color == AppColors.white ? AppColors.line : color),
      ),
      child: child,
    );
  }
}

/// Small blue square logo.
class MasarLogo extends StatelessWidget {
  const MasarLogo({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(size * 0.3)),
      child: Icon(Icons.trending_up_rounded, color: AppColors.white, size: size * 0.7),
    );
  }
}
