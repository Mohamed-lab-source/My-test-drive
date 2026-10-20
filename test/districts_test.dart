import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/districts.dart';

void main() {
  test('the app knows every district the build tool gives out, with the same Arabic name', () {
    final js = File('tool/districts.mjs').readAsStringSync();
    final pairs = RegExp(r'\[\s*"([^"]+)",\s*"([^"]+)",\s*"(cairo|giza|alexandria)"').allMatches(js).toList();
    expect(pairs.length, greaterThan(20));
    for (final m in pairs) {
      expect(districts[m.group(1)]?.$1, m.group(2), reason: m.group(1));
    }
  });

  test('area names and search words', () {
    expect(areaName('Maadi', arabic: true), 'المعادي');
    expect(areaName('Maadi', arabic: false), 'Maadi');
    expect(areaName('Some Street', arabic: true), 'Some Street');
    expect(areaSearchText('New Cairo (5th Settlement)'), contains('fifth settlement'));
    expect(areaSearchText('التجمع الخامس'), contains('New Cairo'));
    expect(areaSearchText('Heliopolis'), contains('masr el gedida'));
    expect(areaSearchText('Dokki'), contains('doki'));
    expect(areaSearchText('Unknown'), 'Unknown');
  });
}
