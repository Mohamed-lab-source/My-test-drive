import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/pocket.dart';
import 'package:khroga/models/opening_hours.dart';
import 'package:khroga/models/plan.dart';

OutingPlan _plan(String id, String title, {String? date, DateTime? created, List<PlanStop>? stops}) => OutingPlan(
      id: id,
      title: title,
      summary: '',
      source: 'local',
      stops: stops ??
          const [
            PlanStop(placeId: 'a', name: 'Test Cafe', category: 'cafe', startTime: '18:00', durationMinutes: 60, area: 'Zamalek'),
            PlanStop(placeId: 'b', name: 'Test Park', category: 'park', startTime: '19:15', durationMinutes: 45, kmFromPrevious: 0.8),
            PlanStop(placeId: 'c', name: 'Test Diner', category: 'restaurant', startTime: '20:15', durationMinutes: 75, kmFromPrevious: 0.6),
          ],
      request: PlanRequest(city: 'cairo', groupSize: 2, vibes: const [], timeOfDay: 'evening', stops: 3, date: date),
      tips: const [],
      createdAt: created,
    );

void main() {
  test('tip and car split use only the typed numbers', () {
    final t = tipShare(600, 10, 4);
    expect(t.tip, 60);
    expect(t.total, 660);
    expect(t.each, 165);
    final c = carSplit(km: 40, litresPer100: 8, pricePerLitre: 15, people: 4, extra: 20);
    expect(c.litres, closeTo(3.2, 1e-9));
    expect(c.cost, closeTo(68, 1e-9));
    expect(c.each, closeTo(17, 1e-9));
    expect(tipShare(100, 0, 0).each, 100);
  });

  test('rough steps and calories', () {
    expect(roughSteps(1), 1300);
    expect(roughKcal(2), 110);
  });

  test('qibla from Cairo points south-east', () {
    final b = qiblaBearing(30.0444, 31.2357);
    expect(b, inInclusiveRange(133, 139));
  });

  test('Hijri date (arithmetic calendar)', () {
    final h = hijriDate(DateTime(2026, 10, 25));
    expect(h.year, 1448);
    expect(h.month, 5);
    expect(h.day, inInclusiveRange(12, 15));
    // 1 Ramadan 1447 was around 18 February 2026.
    final r = hijriDate(DateTime(2026, 2, 19));
    expect(r.month, 9);
    expect(r.day, inInclusiveRange(1, 3));
    final days = daysUntilHijriMonth(DateTime(2026, 10, 25), 9);
    expect(days, inInclusiveRange(100, 112)); // early February 2027
    expect(daysUntilHijri(DateTime(2026, 10, 25), 9, 1), days);
    // Eid al-Fitr comes about 29–30 days after Ramadan starts.
    expect(daysUntilHijri(DateTime(2026, 10, 25), 10, 1) - days, inInclusiveRange(29, 30));
  });

  test('plus codes', () {
    final pyramids = plusCode(29.9792, 31.1342);
    expect(pyramids.length, 11);
    expect(pyramids[8], '+');
    expect(pyramids.startsWith('7GXH'), isTrue);
    expect(plusCode(30.0444, 31.2357).startsWith('8G'), isTrue);
  });

  test('opens in (from opening hours)', () {
    final h = OpeningHours.parse('Mo-Su 10:00-23:00')!;
    expect(h.minutesUntilOpen(DateTime(2026, 10, 25, 9, 15)), 45);
    expect(h.minutesUntilOpen(DateTime(2026, 10, 25, 12)), isNull); // open now
    expect(h.minutesUntilOpen(DateTime(2026, 10, 25, 23, 30)), isNull); // nothing later today
  });

  test('clock text', () {
    expect(clockText(const Duration(seconds: 65)), '01:05');
    expect(clockText(const Duration(hours: 1, minutes: 2, seconds: 3)), '1:02:03');
  });

  test('plan glance: span, km, mix, after sunset, checklist', () {
    final p = _plan('p', 'Night out');
    expect(planSpanMinutes(p.stops), 210); // 18:00 → 21:30
    expect(planWalkKm(p.stops), closeTo(1.4, 1e-9));
    expect(categoryMix(p.stops).length, 3);
    // In Cairo in December the sun sets around 17:00, so all three are after it.
    expect(stopsAfterSunset(p.stops, DateTime(2026, 12, 1), 30.04, 31.24, utcOffset: const Duration(hours: 2)), {0, 1, 2});
    expect(stopsAfterSunset(p.stops, DateTime(2026, 6, 21), 30.04, 31.24, utcOffset: const Duration(hours: 3)), {2}); // sunset ~19:59
    final text = checklistText(p, {'a'});
    expect(text, contains('☑ 18:00 Test Cafe'));
    expect(text, contains('☐ 19:15 Test Park'));
  });

  test('search, sort and pin plans', () {
    final a = _plan('a', 'Zamalek night', date: '2026-11-02', created: DateTime(2026, 10, 1));
    final b = _plan('b', 'Family day', date: '2026-10-28', created: DateTime(2026, 10, 3));
    final c = _plan('c', 'Another one', created: DateTime(2026, 10, 2));
    expect(searchPlans([a, b, c], 'zamalek').map((p) => p.id), ['a', 'b', 'c']); // area of stop 1
    expect(searchPlans([a, b, c], 'family').map((p) => p.id), ['b']);
    expect(searchPlans([a, b, c], 'park diner').length, 3);
    expect(searchPlans([a, b, c], '').length, 3);
    expect(sortPlans([a, b, c], PlanSort.soonest).map((p) => p.id), ['b', 'a', 'c']);
    expect(sortPlans([a, b, c], PlanSort.newest).map((p) => p.id), ['b', 'c', 'a']);
    expect(sortPlans([a, b, c], PlanSort.title).map((p) => p.id), ['c', 'b', 'a']);
    expect(pinnedFirst([a, b, c], ['c']).map((p) => p.id), ['c', 'a', 'b']);
  });

  test('rock paper scissors', () {
    expect(rpsWinner(0, 2), 1); // rock beats scissors
    expect(rpsWinner(1, 0), 1); // paper beats rock
    expect(rpsWinner(2, 1), 1); // scissors beat paper
    expect(rpsWinner(2, 0), -1);
    expect(rpsWinner(1, 1), 0);
  });

  test('lists are not empty', () {
    expect(wouldYouRather().length, greaterThanOrEqualTo(20));
    expect(charadesWords().values.every((l) => l.length >= 12), isTrue);
    expect(groupNameIdeas().toSet().length, groupNameIdeas().length);
  });

  test('phone data export is JSON and nickname greeting', () {
    final j = jsonDecode(exportPhoneData({'b': 1, 'a': 'x'})) as Map;
    expect(j['app'], 'Khroga');
    expect((j['phoneData'] as Map).keys.toList(), ['a', 'b']);
    expect(withNickname('Good morning', 'Misho'), 'Good morning, Misho');
    expect(withNickname('Good morning', ' '), 'Good morning');
  });
}
