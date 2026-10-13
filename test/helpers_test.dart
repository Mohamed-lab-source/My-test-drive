// Test-only sample data (fake names on purpose, never shipped in the app).
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/helpers.dart';
import 'package:khroga/data/checkins_repository.dart';
import 'package:khroga/data/groups_repository.dart' show shouldUpdatePreview;
import 'package:khroga/models/opening_hours.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/models/social.dart';
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
  moreTests();
  limitTests();
  batch5Tests();
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

void moreTests() {
  group('new helpers', () {
    test('WhatsApp only for Egyptian mobile numbers', () {
      expect(whatsappUrl('010 1234 5678').toString(), 'https://wa.me/201012345678');
      expect(whatsappUrl('+20 12 3456 7890').toString(), 'https://wa.me/201234567890');
      expect(whatsappUrl('02 2735 0000'), isNull, reason: 'landline');
      expect(whatsappUrl(null), isNull);
    });

    test('walking time and floors', () {
      expect(walkingMinutes(0.75), 10);
      const g = Place(id: 'g', name: 'Test G', category: 'shop', city: 'cairo',
          details: PlaceFacts(level: '0'));
      const f1 = Place(id: 'f', name: 'Test F', category: 'shop', city: 'cairo',
          details: PlaceFacts(level: '1'));
      const u = Place(id: 'u', name: 'Test U', category: 'shop', city: 'cairo');
      expect(byFloor([u, f1, g]).keys.toList(), ['Ground floor', 'Floor 1', 'Floor not listed']);
    });

    test('compare text never guesses', () {
      expect(factText(null), 'Unknown');
      expect(factText(true), 'Yes');
      expect(factText('limited'), 'Limited');
    });

    test('tip of the day changes daily', () {
      expect(tipOfTheDay(DateTime(2026, 1, 1)), isNot(tipOfTheDay(DateTime(2026, 1, 2))));
    });
  });

  group('editing stops', () {
    test('time, length, note', () {
      final stops = [_s('a', start: '18:00', minutes: 60)];
      expect(setStopTime(stops, 0, '19:15').first.startTime, '19:15');
      expect(setStopDuration(stops, 0, 5).first.durationMinutes, 15);
      expect(setStopNote(stops, 0, ' Book a table ').first.note, 'Book a table');
      expect(setStopNote(setStopNote(stops, 0, 'x'), 0, '').first.note, isNull);
      expect(setStopNote(stops, 0, 'x').first.startTime, '18:00', reason: 'keeps other fields');
    });

    test('shortest route keeps the first stop and goes nearest next', () {
      final stops = [
        _s('start', start: '18:00', minutes: 60, lat: 30.00, lng: 31.00),
        _s('far', minutes: 60, lat: 30.20, lng: 31.00),
        _s('near', minutes: 60, lat: 30.01, lng: 31.00),
      ];
      final r = shortestRoute(stops);
      expect(r.map((s) => s.placeId), ['start', 'near', 'far']);
      expect(r[1].startTime, '19:20');
      expect(r[1].kmFromPrevious, isNotNull);
    });

    test('plan around a spot only uses places nearby', () {
      const near = Place(id: 'n', name: 'Test N', category: 'cafe', city: 'cairo', lat: 30.01, lng: 31.0);
      const far = Place(id: 'f', name: 'Test F', category: 'cafe', city: 'cairo', lat: 30.2, lng: 31.0);
      const noLoc = Place(id: 'x', name: 'Test X', category: 'cafe', city: 'cairo');
      const r = PlanRequest(
          city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening', nearLat: 30.0, nearLng: 31.0);
      expect(passesFilters(near, r), isTrue);
      expect(passesFilters(far, r), isFalse);
      expect(passesFilters(noLoc, r), isFalse);
      expect(PlanRequest.fromMap(r.toMap()).hasAnchor, isTrue);
    });

    test('other branches: same brand or name, nearest first', () {
      const a = Place(id: 'a', name: 'Test Chain', category: 'cafe', city: 'cairo', lat: 30, lng: 31);
      const b = Place(id: 'b', name: 'test chain', category: 'cafe', city: 'cairo', lat: 30.3, lng: 31);
      const c = Place(id: 'c', name: 'Test Chain Zamalek', category: 'cafe', city: 'cairo', lat: 30.01, lng: 31,
          details: PlaceFacts(brand: 'Test Chain'));
      const d = Place(id: 'd', name: 'Other', category: 'cafe', city: 'cairo');
      expect(otherBranches(a, [a, b, c, d]).map((p) => p.id), ['c', 'b']);
    });
  });

  group('one part of town', () {
    Place at(String id, double lat, {String? area, String category = 'cafe'}) => Place(
        id: id, name: 'Test $id', category: category, city: 'cairo', lat: lat, lng: 31.0, area: area);

    test('anywhere: stops stay close to the best match', () {
      final ranked = [at('best', 30.00), at('far', 30.30), at('near', 30.02), at('near2', 30.03)];
      expect(keepClose(ranked, 3).map((p) => p.id), ['best', 'near', 'near2']);
    });

    test('widens only when there are too few nearby', () {
      final ranked = [at('best', 30.00), at('mid', 30.06), at('far', 30.50)];
      expect(keepClose(ranked, 2).map((p) => p.id), ['best', 'mid']);
      expect(keepClose(ranked, 3).length, 3, reason: 'falls back to everything');
    });

    test('area centres come from real coordinates, small areas left out', () {
      final places = [
        for (var i = 0; i < 5; i++) at('z$i', 30.0 + i * 0.002, area: 'Test Zamalek'),
        at('m1', 29.96, area: 'Test Maadi'),
        at('s1', 30.0, area: 'Test Zamalek', category: 'shop'),
      ];
      final areas = areaCenters(places, 'cairo');
      expect(areas.map((a) => a.name), ['Test Zamalek']);
      expect(areas.first.count, 5);
      expect(areas.first.lat, closeTo(30.004, 1e-9));
    });

    test('picked distance is used and saved', () {
      const r = PlanRequest(
          city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening',
          nearLat: 30.0, nearLng: 31.0, radiusKm: 1);
      expect(passesFilters(at('a', 30.005), r), isTrue);
      expect(passesFilters(at('b', 30.02), r), isFalse);
      expect(PlanRequest.fromMap(r.toMap()).radiusKm, 1);
      expect(PlanRequest.fromMap(const {}).radiusKm, PlanRequest.defaultRadiusKm);
    });
  });

  test('time ago and fresh check-ins', () {
    final now = DateTime(2026, 10, 5, 20);
    expect(timeAgo(now.subtract(const Duration(seconds: 20)), now), 'just now');
    expect(timeAgo(now.subtract(const Duration(minutes: 5)), now), '5 min ago');
    expect(timeAgo(now.subtract(const Duration(hours: 3)), now), '3 h ago');
    expect(timeAgo(now.subtract(const Duration(days: 1)), now), '1 day ago');
    CheckIn at(Duration ago) =>
        CheckIn(uid: 'u', name: 'Test', placeId: 'p', placeName: 'Test', createdAt: now.subtract(ago));
    expect(at(const Duration(hours: 23)).isFresh(now), isTrue);
    expect(at(const Duration(hours: 25)).isFresh(now), isFalse);
    expect(const CheckIn(uid: 'u', name: '', placeId: '', placeName: '').isFresh(now), isFalse);
  });

  test('small helpers for links, hours and websites', () {
    expect(websiteDomain('https://www.test-cafe.example/menu'), 'test-cafe.example');
    expect(websiteDomain('test.example'), 'test.example');
    expect(websiteDomain(null), isNull);
    expect(splitLinks('see https://a.example/x now'), [('see ', false), ('https://a.example/x', true), (' now', false)]);
    expect(splitLinks('no links'), [('no links', false)]);
    const p = Place(id: 'x', name: 'Test', category: 'cafe', city: 'cairo', lat: 30, lng: 31,
        openingHours: 'Mo-Fr 09:00-17:00; Sa,Su off');
    expect(todaysHours(p, DateTime(2026, 10, 5)), '09:00–17:00');
    expect(todaysHours(p, DateTime(2026, 10, 10)), 'Closed');
    expect(osmNoteUrl(p).toString(), contains('map=19/30.0/31.0'));
    expect(transitUrl(p)!.queryParameters['travelmode'], 'transit');
    expect(totalStopMinutes([60, null, 90]), 150);
  });

  test('poll counts votes', () {
    const p = Poll(id: 'p', uid: 'u', question: 'Q', options: ['A', 'B'], votes: {'x': 0, 'y': 1, 'z': 1});
    expect(p.countFor(1), 2);
    expect(Poll.fromMap('p', {'options': ['A', 'B'], 'votes': {'x': 1}}).votes, {'x': 1});
  });
}

void limitTests() {
  group('using fewer free resources', () {
    test('describeStop uses only map facts', () {
      const p = Place(
          id: 'p', name: 'Test Cafe', category: 'cafe', city: 'cairo', kind: 'cafe', cuisine: 'coffee_shop',
          openingHours: 'Mo-Su 08:00-23:00', details: PlaceFacts(wifi: true));
      final line = describeStop(p, at: DateTime(2026, 10, 5, 18), kmFromPrevious: 0.84);
      expect(line, 'cafe · coffee shop · open then · 📶 Wi-Fi · 0.8 km from the last stop');
      expect(describeStop(const Place(id: 'x', name: 'Test', category: 'park', city: 'cairo')), 'Parks');
    });

    test('local title names the vibe, time and area', () {
      const r = PlanRequest(city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening');
      expect(localTitle(r, const [PlanStop(placeId: 'a', name: 'Test', category: 'cafe', area: 'Test Area')]),
          '😌 Chill Evening in Test Area');
      expect(localTitle(r, const []), '😌 Chill Evening in Cairo');
    });

    test('AI words never change places, order or times', () {
      final plan = OutingPlan(
        id: 'p',
        title: 'Old',
        summary: '',
        request: const PlanRequest(city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening'),
        stops: const [
          PlanStop(placeId: 'a', name: 'Test A', category: 'cafe', startTime: '18:00', why: 'old'),
          PlanStop(placeId: 'b', name: 'Test B', category: 'cafe', startTime: '19:30'),
        ],
      );
      const words = ProposedPlan(title: 'New', summary: 'Nice', tips: ['Tip'], stops: [
        ProposedStop(placeId: 'b', why: 'Lovely B'),
        ProposedStop(placeId: 'a', why: 'Lovely A'),
      ]);
      final next = applyAiWords(plan, words);
      expect(next.title, 'New');
      expect(next.stops.map((s) => s.placeId), ['a', 'b']);
      expect(next.stops.map((s) => s.startTime), ['18:00', '19:30']);
      expect(next.stops.map((s) => s.why), ['Lovely A', 'Lovely B']);
    });

    test('a burst of chat messages updates the group preview once', () {
      final now = DateTime(2026, 10, 5, 20);
      expect(shouldUpdatePreview(null, now), isTrue);
      expect(shouldUpdatePreview(now.subtract(const Duration(seconds: 30)), now), isFalse);
      expect(shouldUpdatePreview(now.subtract(const Duration(minutes: 3)), now), isTrue);
    });
  });
}

void batch5Tests() {
  group('batch 5 helpers', () {
    test('12-hour clock', () {
      expect(showTime('18:30', clock24: false), '6:30 PM');
      expect(showTime('00:15', clock24: false), '12:15 AM');
      expect(showTime('18:30'), '18:30');
      expect(showTime(null), '');
    });

    test('Arabic search ignores spelling differences', () {
      expect(normalizeSearch('القاهرة'), normalizeSearch('القاهره'));
      expect(normalizeSearch('أحمد'), normalizeSearch('احمد'));
      expect(normalizeSearch('مستشفى'), normalizeSearch('مستشفي'));
      expect(normalizeSearch('Zamalek'), 'zamalek');
    });

    test('emoji-only messages', () {
      expect(isOnlyEmoji('😂😂'), isTrue);
      expect(isOnlyEmoji('ok 👍'), isFalse);
      expect(isOnlyEmoji('تمام'), isFalse);
      expect(isOnlyEmoji(''), isFalse);
    });

    test('bill: service first, VAT on food + service, tip on the amount', () {
      expect(billTotal(1000), 1000);
      expect(billTotal(1000, servicePct: 12), closeTo(1120, 1e-9));
      expect(billTotal(1000, servicePct: 12, vatPct: 14), closeTo(1276.8, 1e-9));
      expect(billTotal(1000, tipPct: 10), closeTo(1100, 1e-9));
    });

    test('shift all plan times', () {
      final stops = [_s('a', start: '18:00', minutes: 60), _s('b')];
      final later = shiftTimes(stops, 30);
      expect(later.first.startTime, '18:30');
      expect(later.last.startTime, isNull);
      expect(shiftTimes(stops, -30).first.startTime, '17:30');
    });

    test('minutes until closing', () {
      expect(OpeningHours.parse('Mo-Su 10:00-23:00')!.minutesUntilClose(mon(22, 15)), 45);
      expect(OpeningHours.parse('Mo-Su 18:00-02:00')!.minutesUntilClose(mon(1, 30)), 30);
      expect(OpeningHours.parse('Mo-Su 10:00-23:00')!.minutesUntilClose(mon(9)), isNull);
      expect(OpeningHours.parse('24/7')!.minutesUntilClose(mon(9)), isNull);
    });

    test('place helpers only use real facts', () {
      const p = Place(id: 'x', name: 'Test Cafe', category: 'cinema', city: 'cairo', lat: 30, lng: 31,
          phone: '0100', address: 'Test St');
      expect(categoryTip('cinema'), contains('showtimes'));
      expect(categoryTip('cafe'), isNull);
      expect(geoUrl(p).toString(), startsWith('geo:30.0,31.0'));
      expect(placeInfoText(p), contains('Test St'));
      expect(visitCalendarUrl(p, DateTime(2026, 10, 9, 19)).queryParameters['text'], 'Test Cafe');
    });
  });
}
