// Test-only sample data (fake names on purpose, never shipped in the app).
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/helpers.dart';
import 'package:khroga/models/opening_hours.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/planner/planner.dart';

// 2026-10-05 is a Monday.
DateTime mon(int h, [int m = 0]) => DateTime(2026, 10, 5, h, m);

PlanStop _s(String id, {String? start, int? minutes, double? lat, double? lng, String? area}) =>
    PlanStop(
        placeId: id,
        name: 'Test $id',
        category: 'cafe',
        startTime: start,
        durationMinutes: minutes,
        lat: lat,
        lng: lng,
        area: area);

void main() {
  group('opening hours status', () {
    test('open: says when it closes, also after midnight', () {
      expect(OpeningHours.parse('Mo-Su 10:00-23:00')!.statusText(mon(12)), 'Open · closes 23:00');
      expect(OpeningHours.parse('Mo-Su 18:00-02:00')!.statusText(mon(1)), 'Open · closes 02:00');
    });

    test('closed: says when it opens next', () {
      final h = OpeningHours.parse('Mo-Su 10:00-23:00')!;
      expect(h.statusText(mon(8)), 'Closed · opens 10:00');
      expect(h.statusText(mon(23, 30)), 'Closed · opens 10:00 tomorrow');
      expect(OpeningHours.parse('Mo-Fr 09:00-17:00; Sa,Su off')!.statusText(DateTime(2026, 10, 10, 12)),
          'Closed · opens 09:00 Mon');
    });

    test('unknown stays unknown', () {
      expect(OpeningHours.parse('Mo-Fr 09:00-17:00')!.statusText(DateTime(2026, 10, 10, 12)), isNull);
      expect(OpeningHours.parse('24/7')!.statusText(mon(3)), 'Open 24 hours');
    });

    test('week table only when every day is known', () {
      final t = OpeningHours.parse('Mo-Fr 09:00-17:00; Sa,Su off')!.weekTable()!;
      expect(t.first, ('Mon', '09:00–17:00'));
      expect(t.last, ('Sun', 'Closed'));
      expect(OpeningHours.parse('Mo-Fr 09:00-17:00')!.weekTable(), isNull);
    });
  });

  group('plan timing', () {
    test('end times', () {
      expect(stopEndTime(_s('a', start: '18:00', minutes: 90)), '19:30');
      expect(stopEndTime(_s('a', start: '23:30', minutes: 60)), '00:30');
      expect(stopEndTime(_s('a')), isNull);
      expect(planEndTime([_s('a', start: '18:00', minutes: 60), _s('b', start: '19:20', minutes: 90)]),
          '20:50');
    });

    test('directions between stops need real coordinates', () {
      final a = _s('a', lat: 30.0, lng: 31.0);
      expect(legMapsUrl(a, _s('b', lat: 30.1, lng: 31.1))!.queryParameters['destination'], '30.1,31.1');
      expect(legMapsUrl(a, _s('b')), isNull);
    });

    test('calendar link uses the plan day and stop times', () {
      final plan = OutingPlan(
        id: 'p',
        title: 'Test outing',
        summary: '',
        stops: [_s('a', start: '18:00', minutes: 60, area: 'Test Area')],
        request: const PlanRequest(
            city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening', date: '2026-10-09'),
      );
      final url = planCalendarLink(plan);
      final start = DateTime(2026, 10, 9, 18).toUtc();
      expect(url.queryParameters['dates']!.startsWith('${start.year}${start.month}0${start.day}'), isTrue);
      expect(url.queryParameters['text'], 'Test outing');
      expect(url.queryParameters['details'], contains('Test a'));
    });
  });

  group('little helpers', () {
    test('greeting uses the first name only', () {
      expect(greeting(9, 'Test Person'), 'Good morning, Test');
      expect(greeting(20, null), 'Good evening');
      expect(greeting(2, ''), 'Up late');
    });

    test('chat day labels', () {
      final now = DateTime(2026, 10, 9, 12);
      expect(chatDayLabel(DateTime(2026, 10, 9, 1), now), 'Today');
      expect(chatDayLabel(DateTime(2026, 10, 8, 23), now), 'Yesterday');
      expect(chatDayLabel(DateTime(2026, 10, 5), now), 'Monday');
      expect(chatDayLabel(DateTime(2026, 9, 1), now), '1 Sep');
      expect(chatDayLabel(DateTime(2025, 9, 1), now), '1 Sep 2025');
    });

    test('next weekday', () {
      expect(nextWeekday(mon(10), DateTime.friday), DateTime(2026, 10, 9));
      expect(nextWeekday(mon(10), DateTime.monday), DateTime(2026, 10, 5));
    });

    test('badges come only from real counts', () {
      expect(badgesFor(const MyCounts()).where((b) => b.earned), isEmpty);
      final b = badgesFor(const MyCounts(plans: 1, visited: 5));
      expect(b.where((x) => x.earned).map((x) => x.title), ['First plan', 'Out and about']);
    });

    test('links only when the map has the facts', () {
      const p = Place(id: 'x', name: 'Test Cafe', category: 'cafe', city: 'cairo', area: 'Test Area');
      expect(wazeUrl(p), isNull);
      expect(wikidataUrl(p), isNull);
      expect(googleSearchUrl(p).queryParameters['q'], 'Test Cafe Test Area cairo');
      expect(placeChatText(p), '📍 Test Cafe (Test Area)');
      const q = Place(id: 'y', name: 'Test', category: 'cafe', city: 'cairo', lat: 30, lng: 31, wikidata: 'Q1');
      expect(wazeUrl(q)!.queryParameters['ll'], '30.0,31.0');
      expect(wikidataUrl(q).toString(), 'https://www.wikidata.org/wiki/Q1');
    });
  });
}
