import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/fun.dart';
import 'package:khroga/app/helpers.dart';
import 'package:khroga/app/i18n.dart';
import 'package:khroga/app/strings_ar.dart';
import 'package:khroga/app/theme.dart';
import 'package:khroga/features/profile/welcome_screen.dart';
import 'package:khroga/models/opening_hours.dart';
import 'package:khroga/models/place.dart';
import 'package:intl/intl.dart' show DateFormat;

void main() {
  tearDown(() => appLang = 'en');

  test('English stays English; Arabic translates', () {
    expect(tr('Save'), 'Save');
    appLang = 'ar';
    expect(tr('Save'), 'حفظ');
    expect(trf('{n} places', {'n': 12}), '12 مكان');
    expect(tr('Some text nobody translated'), 'Some text nobody translated');
    expect(Categories.label('cafe'), 'كافيهات');
  });

  test('every translation keeps the same {blanks}', () {
    final blank = RegExp(r'\{(\w+)\}');
    for (final e in arabic.entries) {
      final en = blank.allMatches(e.key).map((m) => m.group(1)).toSet();
      final ar = blank.allMatches(e.value).map((m) => m.group(1)).toSet();
      expect(ar, en, reason: e.key);
    }
  });

  test('every tr() text in the app has an Arabic translation', () {
    const single = r"'(?:[^'\\\n]|\\.)*'";
    const dbl = r'"(?:[^"\\\n]|\\.)*"';
    final lit = RegExp('$single|$dbl');
    final call = RegExp(r'\btrf?\(\s*((?:' '$single|$dbl' r')(?:\s*(?:' '$single|$dbl' r'))*)');
    final missing = <String>{};
    for (final f in Directory('lib').listSync(recursive: true).whereType<File>()) {
      if (!f.path.endsWith('.dart')) continue;
      for (final m in call.allMatches(f.readAsStringSync())) {
        final text = lit
            .allMatches(m.group(1)!)
            .map((l) => l.group(0)!.substring(1, l.group(0)!.length - 1))
            .join()
            .replaceAll(r"\'", "'")
            .replaceAll(r'\"', '"')
            .replaceAll(r'\n', '\n')
            .replaceAll(r'\$', r'$');
        if (RegExp('[A-Za-z]').hasMatch(text) && !arabic.containsKey(text)) missing.add(text);
      }
    }
    expect(missing, isEmpty, reason: 'Add these to lib/app/strings_ar.dart');
  });

  test('hours, times and badges speak Arabic', () {
    appLang = 'ar';
    expect(OpeningHours.parse('Mo-Su 10:00-23:00')!.statusText(DateTime(2026, 10, 5, 12)),
        'فاتح · بيقفل 23:00');
    expect(timeAgo(DateTime(2026, 10, 5, 10), DateTime(2026, 10, 5, 13)), 'من 3 ساعة');
    expect(allBadges(const BadgeCounts()).first.title, 'أول خطة');
    const p = Place(id: 'x', name: 'Test Cafe', nameAr: 'كافيه تجربة', category: 'cafe', city: 'cairo');
    expect(p.shownName, 'كافيه تجربة');
    expect(p.otherName, 'Test Cafe');
    appLang = 'en';
    expect(p.shownName, 'Test Cafe');
  });

  testWidgets('welcome screen in Arabic, right to left, fits a small phone', (tester) async {
    final view = tester.view;
    view.physicalSize = const Size(360 * 3, 720 * 3);
    view.devicePixelRatio = 3;
    addTearDown(view.reset);
    appLang = 'ar';
    await tester.pumpWidget(ProviderScope(
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        theme: buildTheme(accent: accentThemes.first, brightness: Brightness.dark),
        home: const WelcomeScreen(),
      ),
    ));
    await tester.pump();
    expect(find.text('قولنا المزاج'), findsOneWidget);
    expect(DateFormat('EEE d MMM').format(DateTime(2026, 10, 5)), contains('أكتوبر'));
    expect(Directionality.of(tester.element(find.text('قولنا المزاج'))), TextDirection.rtl);
    expect(tester.takeException(), isNull);
  });
}
