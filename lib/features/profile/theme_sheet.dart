import '../../app/i18n.dart';
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
        padding: EdgeInsets.fromLTRB(KSpace.lg, 0, KSpace.lg, KSpace.xl),
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
        Text(tr('Look, colors & text size'), style: text.titleLarge),
        const SizedBox(height: KSpace.md),
        SegmentedButton<ThemeMode>(
          showSelectedIcon: false,
          segments: [
            ButtonSegment(
                value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text(tr('Dark'))),
            ButtonSegment(
                value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text(tr('Light'))),
            ButtonSegment(
                value: ThemeMode.system, icon: Icon(Icons.phone_android), label: Text(tr('Phone'))),
          ],
          selected: {settings.mode},
          onSelectionChanged: settings.followSun ? null : (s) => notifier.setMode(s.first),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(tr('Light by day, dark after sunset')),
          subtitle: Text(tr('Uses the real sunset time in your city')),
          value: settings.followSun,
          onChanged: notifier.setFollowSun,
        ),
        const SizedBox(height: KSpace.lg),
        Text(tr('Text size'), style: text.titleMedium),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            for (final e in textScales.entries)
              ChoiceChip(
                label: Text(tr(e.value), style: TextStyle(fontSize: 12 * e.key)),
                selected: settings.textScale == e.key,
                showCheckmark: false,
                onSelected: (_) => notifier.setTextScale(e.key),
              ),
          ],
        ),
        const SizedBox(height: KSpace.lg),
        Text(tr('Theme'), style: text.titleMedium),
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
                color2: isDark ? t.dark2 : t.light2,
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
    required this.color2,
    required this.selected,
    required this.onTap,
  });

  final AccentTheme theme;
  final Color color;
  final Color color2;
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
        child: AnimatedContainer(
          duration: KMotion.medium,
          decoration: BoxDecoration(
            color: selected ? Color.alphaBlend(color.withValues(alpha: 0.10), k.surface) : k.surface,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: selected ? color : k.line, width: selected ? 2.5 : 1),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedContainer(
                duration: KMotion.medium,
                curve: Curves.easeOutBack,
                width: selected ? 46 : 40,
                height: selected ? 46 : 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: AlignmentDirectional.topStart,
                    end: AlignmentDirectional.bottomEnd,
                    colors: [color, color2],
                  ),
                  boxShadow: selected
                      ? [BoxShadow(color: color.withValues(alpha: 0.4), blurRadius: 12, offset: const Offset(0, 4))]
                      : null,
                ),
                child: selected
                    ? Icon(Icons.check,
                        color: ThemeData.estimateBrightnessForColor(color) == Brightness.dark
                            ? Colors.white
                            : Colors.black)
                    : null,
              ),
              const SizedBox(height: KSpace.sm),
              Text(tr(theme.name),
                  style: TextStyle(fontWeight: FontWeight.w600, color: k.ink)),
            ],
          ),
        ),
      ),
    );
  }
}
