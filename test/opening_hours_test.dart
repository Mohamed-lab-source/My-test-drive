import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/opening_hours.dart';

// 2026-10-05 is a Monday.
DateTime mon(int h, [int m = 0]) => DateTime(2026, 10, 5, h, m);
DateTime day(int weekday, int h, [int m = 0]) => DateTime(2026, 10, 4 + weekday, h, m);

void main() {
  test('simple daily hours', () {
    final h = OpeningHours.parse('Mo-Su 10:00-23:00')!;
    expect(h.isOpenAt(mon(9, 59)), isFalse);
    expect(h.isOpenAt(mon(10)), isTrue);
    expect(h.isOpenAt(mon(22, 59)), isTrue);
    expect(h.isOpenAt(mon(23)), isFalse);
  });

  test('24/7', () {
    expect(OpeningHours.parse('24/7')!.isOpenAt(mon(3)), isTrue);
  });

  test('closes after midnight', () {
    final h = OpeningHours.parse('Mo-Su 18:00-02:00')!;
    expect(h.isOpenAt(mon(1)), isTrue, reason: "Sunday's hours run into Monday");
    expect(h.isOpenAt(mon(3)), isFalse);
    expect(h.isOpenAt(mon(20)), isTrue);
  });

  test('different days and days off', () {
    final h = OpeningHours.parse('Mo-Fr 09:00-17:00; Sa 10:00-14:00; Su off')!;
    expect(h.isOpenAt(day(1, 12)), isTrue);
    expect(h.isOpenAt(day(6, 15)), isFalse);
    expect(h.isOpenAt(day(6, 11)), isTrue);
    expect(h.isOpenAt(day(7, 12)), isFalse);
  });

  test('split hours and day lists', () {
    final h = OpeningHours.parse('Sa,Mo-We 10:00-14:00,17:00-23:00')!;
    expect(h.isOpenAt(day(1, 15)), isFalse, reason: 'lunch break');
    expect(h.isOpenAt(day(1, 18)), isTrue);
    expect(h.isOpenAt(day(6, 11)), isTrue);
    expect(h.isOpenAt(day(4, 11)), isNull, reason: "Thursday isn't listed");
  });

  test('week wrapping ranges like Sa-Th', () {
    final h = OpeningHours.parse('Sa-Th 09:00-22:00; Fr 13:00-22:00')!;
    expect(h.isOpenAt(day(5, 10)), isFalse, reason: 'Friday prayer hours');
    expect(h.isOpenAt(day(5, 14)), isTrue);
    expect(h.isOpenAt(day(7, 10)), isTrue);
  });

  test("anything we don't understand is unknown, not guessed", () {
    expect(OpeningHours.parse('Jan-Mar Mo-Fr 09:00-17:00'), isNull);
    expect(OpeningHours.parse('sunrise-sunset'), isNull);
    expect(OpeningHours.parse('10:00+'), isNull);
    expect(OpeningHours.parse(''), isNull);
    expect(OpeningHours.parse(null), isNull);
  });
}
