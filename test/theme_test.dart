import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/theme.dart';

/// WCAG contrast ratio between two colors (1 to 21).
double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final hi = la > lb ? la : lb;
  final lo = la > lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  for (final theme in accentThemes) {
    for (final brightness in Brightness.values) {
      final p = KPalette.of(theme, brightness);
      final label = '${theme.name} ${brightness.name}';

      test('$label: text is easy to read', () {
        // 4.5:1 is the standard for comfortable reading of normal text.
        expect(contrast(p.ink, p.background), greaterThanOrEqualTo(7), reason: 'main text');
        expect(contrast(p.ink, p.surface), greaterThanOrEqualTo(7), reason: 'text on cards');
        expect(contrast(p.inkMuted, p.surface), greaterThanOrEqualTo(4.5), reason: 'secondary text');
        expect(contrast(p.inkMuted, p.background), greaterThanOrEqualTo(4.5));
        expect(contrast(p.onAccent, p.accent), greaterThanOrEqualTo(4.5), reason: 'button text');
        expect(contrast(p.ink, p.accentSoft), greaterThanOrEqualTo(4.5), reason: 'text on chips');
        expect(contrast(p.accent, p.surface), greaterThanOrEqualTo(3), reason: 'accent icons');
      });

      test('$label: theme builds', () {
        final t = buildTheme(accent: theme, brightness: brightness);
        expect(t.brightness, brightness);
        expect(t.extension<KPalette>()!.accent, p.accent);
      });
    }
  }

  test('unknown theme id falls back to the first theme', () {
    expect(accentById('nope').id, accentThemes.first.id);
  });
}
