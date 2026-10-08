import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/extras.dart';
import 'package:khroga/models/place.dart';

void main() {
  test('sunset in Cairo is about right (summer and winter)', () {
    // Cairo, 21 June: sunset ≈ 17:00 UTC (20:00 local summer time).
    final june = sunTimes(DateTime(2026, 6, 21), 30.0444, 31.2357)!;
    expect(june.sunset.isUtc, isTrue);
    expect((june.sunset.hour * 60 + june.sunset.minute) - (17 * 60), inInclusiveRange(-15, 15));
    // 21 December: sunset ≈ 15:00 UTC (17:00 local).
    final dec = sunTimes(DateTime(2026, 12, 21), 30.0444, 31.2357)!;
    expect((dec.sunset.hour * 60 + dec.sunset.minute) - (15 * 60), inInclusiveRange(-15, 15));
    expect(dec.sunrise.isBefore(dec.sunset), isTrue);
    // Alexandria is west of Cairo, so the sun sets later there.
    final alex = sunTimes(DateTime(2026, 12, 21), 31.2001, 29.9187)!;
    expect(alex.sunset.isAfter(dec.sunset), isTrue);
  });

  test('fixed Egyptian holidays and the weekend', () {
    expect(egyptHoliday(DateTime(2026, 10, 6)), isNotNull);
    expect(egyptHoliday(DateTime(2026, 10, 7)), isNull);
    final all = egyptHolidaysOf(2027);
    expect(all.length, 7);
    expect(all.first.$1, DateTime(2027, 1, 7));
    expect(isEgyptWeekend(DateTime(2026, 10, 9)), isTrue); // Friday
    expect(isEgyptWeekend(DateTime(2026, 10, 10)), isTrue); // Saturday
    expect(isEgyptWeekend(DateTime(2026, 10, 11)), isFalse);
  });

  test('distance, direction and duration text', () {
    expect(distanceText(0.347), '350 m');
    expect(distanceText(2.44), '2.4 km');
    expect(distanceText(23.6), '24 km');
    expect(compassDirection(30, 31, 31, 31), 'north');
    expect(compassDirection(30, 31, 30, 32), 'east');
    expect(compassDirection(30, 31, 29, 30), 'south-west');
    expect(durationText(45), '45 min');
    expect(durationText(120), '2 h');
    expect(durationText(95), '1 h 35 min');
  });

  test('days until, lists, digits, initials', () {
    final now = DateTime(2026, 10, 8, 20);
    expect(daysUntilText(DateTime(2026, 10, 8), now), 'today');
    expect(daysUntilText(DateTime(2026, 10, 9), now), 'tomorrow');
    expect(daysUntilText(DateTime(2026, 10, 13), now), 'in 5 days');
    expect(daysUntilText(DateTime(2026, 10, 1), now), isNull);
    expect(readableList(['a', 'b', 'c']), 'a, b and c');
    expect(readableList(['a']), 'a');
    expect(latinDigits('٢٠٢٦ و ۱۲'), '2026 و 12');
    expect(initialsOf('Mohamed Ali Hassan'), 'MH');
    expect(initialsOf(''), '?');
  });

  test('forgiving search allows one typo in longer words', () {
    expect(editDistance('kitten', 'sitten'), 1);
    expect(fuzzyContains('cilantro cafe zamalek', 'zamalk'), isTrue);
    expect(fuzzyContains('cilantro cafe zamalek', 'cilantr cafe'), isTrue);
    expect(fuzzyContains('cilantro cafe zamalek', 'maadi'), isFalse);
    expect(fuzzyContains('cilantro cafe zamalek', 'caf'), isTrue); // plain contains
    expect(fuzzyContains('cilantro cafe zamalek', 'cat'), isFalse); // short: exact only
  });

  test('counting, streaks and areas', () {
    expect(countBy(['a', 'b', 'a', null], (x) => x), [('a', 2), ('b', 1)]);
    final now = DateTime(2026, 10, 8);
    expect(weekStreak([now, now.subtract(const Duration(days: 7)), now.subtract(const Duration(days: 14))], now), 3);
    expect(weekStreak([now.subtract(const Duration(days: 7))], now), 1);
    expect(weekStreak([now.subtract(const Duration(days: 30))], now), 0);

    const a = Place(id: 'a', name: 'Test A', category: 'cafe', city: 'cairo', area: 'Zed', lat: 30, lng: 31, quality: 1);
    const b = Place(id: 'b', name: 'Test B', category: 'cafe', city: 'cairo', area: 'Zed', lat: 32, lng: 33, quality: 5);
    const c = Place(id: 'c', name: 'Test C', category: 'cafe', city: 'giza', area: 'Zed');
    expect(placesInArea([a, b, c], 'cairo', 'Zed').map((p) => p.id), ['b', 'a']);
    expect(centerOf([a, b, c]), (31.0, 32.0));
    expect(centerOf([c]), isNull);
  });

  test('outing ideas only use known vibes and times', () {
    const vibes = {'chill', 'foodie', 'active', 'romantic', 'family', 'culture', 'shopping', 'nightlife'};
    const times = {'morning', 'afternoon', 'evening', 'night'};
    for (final i in outingIdeas) {
      expect(i.vibes.every(vibes.contains), isTrue, reason: i.title);
      expect(times.contains(i.time), isTrue);
      expect(i.stops, inInclusiveRange(1, 5));
    }
    expect(randomOf(<int>[], math.Random(1)), isNull);
    expect(randomOf([7], math.Random(1)), 7);
  });
}
