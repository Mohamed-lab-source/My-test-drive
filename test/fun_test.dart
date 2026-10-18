import 'dart:math' as math;

import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/fun.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';

Place _p(
  String id,
  String cat, {
  String city = 'cairo',
  String? area,
  int quality = 5,
  String? hours,
  PlaceFacts details = const PlaceFacts(),
}) => Place(
  id: id,
  name: 'Test $id',
  category: cat,
  city: city,
  area: area,
  lat: 30,
  lng: 31,
  quality: quality,
  openingHours: hours,
  details: details,
);

void main() {
  test('badges only from real counts, with progress', () {
    expect(allBadges(const BadgeCounts()).where((b) => b.earned), isEmpty);
    final b = allBadges(const BadgeCounts(plans: 1, visited: 5));
    expect(b.where((x) => x.earned).map((x) => x.key), ['plan1', 'been5']);
    expect(b.firstWhere((x) => x.key == 'plan10').progress, closeTo(0.1, 1e-9));
    expect({for (final x in b) x.key}.length, b.length, reason: 'keys are unique');
    expect(newBadges(b, {'plan1'}).map((x) => x.key), ['been5']);
  });

  test('counts from places you have been', () {
    final c = countsFromVisited([
      _p('a', 'cafe', area: 'Zed'),
      _p('b', 'museum', city: 'giza', area: 'Old'),
      _p('c', 'park', area: 'Zed', hours: '24/7'),
    ]);
    expect(c.visited, 3);
    expect(c.kinds, 3);
    expect(c.areas, 2);
    expect(c.cities, 2);
    expect(c.food, 1);
    expect(c.culture, 1);
    expect(c.lateNight, 1);
  });

  test('outing personality needs 3 places and follows them', () {
    expect(outerTypeFor([_p('a', 'cafe')], const []), isNull);
    expect(outerTypeFor([_p('a', 'cafe'), _p('b', 'cafe'), _p('c', 'restaurant')], const [])!.title, 'The Café Hopper');
    expect(
      outerTypeFor([_p('a', 'restaurant'), _p('b', 'restaurant'), _p('c', 'cafe')], const [])!.title,
      'The Foodie',
    );
    expect(outerTypeFor([_p('a', 'museum'), _p('b', 'sight'), _p('c', 'cafe')], const [])!.title, 'The History Buff');
    final mixed = [
      for (final c in ['cafe', 'park', 'museum', 'mall', 'cinema']) _p(c, c),
    ];
    expect(outerTypeFor(mixed, const [])!.title, 'The Explorer');
    expect(outerTypeFor(mixed, const ['nightlife', 'nightlife', 'chill'])!.title, 'The Night Owl');
  });

  test('recap counts only the chosen month', () {
    final from = DateTime(2026, 10), to = DateTime(2026, 11);
    OutingPlan plan(DateTime t, List<String> vibes) => OutingPlan(
      id: '$t',
      title: 'x',
      summary: '',
      stops: const [
        PlanStop(placeId: 'a', name: 'Test A', category: 'cafe', area: 'Zed', kmFromPrevious: 0),
        PlanStop(placeId: 'b', name: 'Test B', category: 'park', area: 'Zed', kmFromPrevious: 2.5),
      ],
      request: PlanRequest(city: 'cairo', groupSize: 2, vibes: vibes, timeOfDay: 'evening', stops: 2),
      tips: const [],
      createdAt: t,
    );
    final r = recapOf(
      from,
      to,
      [
        plan(DateTime(2026, 10, 2), ['chill']),
        plan(DateTime(2026, 10, 9), ['chill', 'foodie']),
        plan(DateTime(2026, 9, 30), ['active']),
      ],
      [(_p('m', 'museum', area: 'Old'), DateTime(2026, 10, 5)), (_p('n', 'mall'), DateTime(2026, 8, 1))],
    );
    expect(r.plans, 2);
    expect(r.stops, 4);
    expect(r.newPlaces, 1);
    expect(r.km, 5.0);
    expect(r.topArea, 'Zed');
    expect(r.topVibe, 'chill');
    expect(r.busiestDay, DateTime.friday);
    expect(recapOf(DateTime(2020), DateTime(2021), const [], const []).isEmpty, isTrue);
  });

  test('bingo: same 9 squares all month, lines counted', () {
    final a = bingoFor(DateTime(2026, 10, 1)).map((s) => s.key).toList();
    final b = bingoFor(DateTime(2026, 10, 30)).map((s) => s.key).toList();
    expect(a, b);
    expect(a.length, 9);
    expect(a.toSet().length, 9);
    expect(bingoLines(List.filled(9, false)), 0);
    expect(bingoLines([true, true, true, false, false, false, false, false, false]), 1);
    expect(bingoLines([true, false, false, false, true, false, false, false, true]), 1);
    expect(bingoLines(List.filled(9, true)), 8);
    final card = bingoFor(DateTime(2026, 10));
    final done = bingoDone(card, [_p('x', 'cafe'), _p('y', 'park')]);
    expect(done.length, 9);
  });

  test('place of the day is stable for a day and real', () {
    final places = [for (var i = 0; i < 20; i++) _p('p$i', 'cafe')] + [_p('s', 'shop')];
    final d = placeOfTheDay(places, DateTime(2026, 10, 13, 9));
    expect(d, isNotNull);
    expect(placeOfTheDay(places.reversed.toList(), DateTime(2026, 10, 13, 22))!.id, d!.id);
    expect(d.category, isNot('shop'));
    expect(placeOfTheDay(const [], DateTime(2026)), isNull);
    expect(luckyPlace(places, math.Random(3))!.category, 'cafe');
  });

  test('smart collections only include what the map says', () {
    final wifi = _p('w', 'cafe', details: const PlaceFacts(wifi: true));
    final unknown = _p('u', 'cafe');
    final late = _p('l', 'restaurant', hours: 'Mo-Su 12:00-02:00');
    final early = _p('e', 'restaurant', hours: 'Mo-Su 09:00-17:00');
    final work = smartCollections.firstWhere((c) => c.key == 'work');
    expect(collectionPlaces(work, [wifi, unknown], 'cairo').map((p) => p.id), ['w']);
    expect(isOpenLate(late), isTrue);
    expect(isOpenLate(early), isFalse);
    expect(isOpenLate(unknown), isFalse);
    expect({for (final c in smartCollections) c.key}.length, smartCollections.length);
  });

  test('area progress and teams', () {
    final all = [for (var i = 0; i < 6; i++) _p('z$i', 'cafe', area: 'Zed')] + [_p('o', 'cafe', area: 'Other')];
    final pr = areaProgress(all, {'z1', 'z2'}, 'cairo');
    expect(pr.length, 1);
    expect(pr.first, (area: 'Zed', total: 6, been: 2));
    final teams = makeTeams(['a', 'b', 'c', 'd', 'e'], 2, math.Random(1));
    expect(teams.length, 2);
    expect(teams.expand((t) => t).toSet(), {'a', 'b', 'c', 'd', 'e'});
    expect((teams[0].length - teams[1].length).abs(), lessThanOrEqualTo(1));
    expect(makeTeams(['a'], 4, math.Random(1)).length, 1);
    expect(nextDays(DateTime(2026, 10, 30), count: 3), [
      DateTime(2026, 10, 30),
      DateTime(2026, 10, 31),
      DateTime(2026, 11, 1),
    ]);
  });

  test('on this day and the activity grid', () {
    final now = DateTime(2026, 10, 18, 12);
    final a = _p('a', 'cafe');
    final b = _p('b', 'park');
    expect(onThisDay([(a, DateTime(2026, 9, 18, 20)), (b, DateTime(2025, 10, 18))], now), (a, 1));
    expect(onThisDay([(b, DateTime(2025, 10, 18, 9))], now), (b, 12));
    expect(onThisDay([(b, DateTime(2026, 10, 17))], now), isNull);
    expect(onThisDay([(b, null)], now), isNull);
    final days = activityDays([now, now, DateTime(2026, 10, 17), DateTime(2026, 1, 1)], now, days: 7);
    expect(days, [0, 0, 0, 0, 0, 1, 2]);
    expect(emergencyNumbers.map((e) => e.$3), containsAll(['122', '123', '180']));
    expect(phrasebook.every((p) => p.$1.isNotEmpty && p.$2.isNotEmpty && p.$3.isNotEmpty), isTrue);
  });
}
