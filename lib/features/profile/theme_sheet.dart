import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../app/theme_settings.dart';

/// Bottom sheet to pick light/dark mode and a colorful theme.
Future<void> showThemeSheet(BuildContext context) => showModalBottomSheet(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (_) => const SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(KSpace.lg, KSpace.lg, KSpace.lg, KSpace.xl),
        child: ThemePicker(),
      ),
    );

class ThemePicker extends ConsumerWidget {
  const ThemePicker({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(themeSettingsProvider);
    final notifier = ref.read(themeSettingsProvider.notifier);
    final text = Theme.of(context).textTheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Look, colors & text size', style: text.titleLarge),
        const SizedBox(height: KSpace.md),
        SegmentedButton<ThemeMode>(
          showSelectedIcon: false,
          segments: const [
            ButtonSegment(
                value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
            ButtonSegment(
                value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
            ButtonSegment(
                value: ThemeMode.system, icon: Icon(Icons.phone_android), label: Text('Phone')),
          ],
          selected: {settings.mode},
          onSelectionChanged: (s) => notifier.setMode(s.first),
        ),
        const SizedBox(height: KSpace.lg),
        Text('Text size', style: text.titleMedium),
        const SizedBox(height: KSpace.sm),
        SegmentedButton<double>(
          showSelectedIcon: false,
          segments: [
            for (final e in textScales.entries)
              ButtonSegment(
                value: e.key,
                label: Text(e.value, style: TextStyle(fontSize: 13 * e.key)),
              ),
          ],
          selected: {settings.textScale},
          onSelectionChanged: (s) => notifier.setTextScale(s.first),
        ),
        const SizedBox(height: KSpace.lg),
        Text('Theme', style: text.titleMedium),
        const SizedBox(height: KSpace.sm),
        GridView.count(
          crossAxisCount: 3,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: KSpace.sm,
          crossAxisSpacing: KSpace.sm,
          childAspectRatio: 1.1,
          children: [
            for (final t in accentThemes)
              _Swatch(
                theme: t,
                color: isDark ? t.dark : t.light,
                selected: t.id == settings.accentId,
                onTap: () => notifier.setAccent(t.id),
              ),
          ],
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.theme,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  final AccentTheme theme;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    return Semantics(
      button: true,
      selected: selected,
      label: '${theme.name} theme',
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            color: k.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: selected ? color : k.line, width: selected ? 2.5 : 1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                child: selected
                    ? Icon(Icons.check,
                        color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark
                            ? Colors.white
                            : Colors.black)
                    : null,
              ),
              const SizedBox(height: KSpace.sm),
              Text(theme.name,
                  style: TextStyle(fontWeight: FontWeight.w600, color: k.ink)),
            ],
          ),
        ),
      ),
    );
  }
}
