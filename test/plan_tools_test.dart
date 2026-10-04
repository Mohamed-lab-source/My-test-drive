// Test-only sample places (fake names on purpose, never shipped in the app).
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/planner/planner.dart';

Place _p(String id, String cat, double lat, double lng, {int quality = 3, String? mall}) =>
    Place(id: id, name: 'Test $id', category: cat, city: 'cairo', lat: lat, lng: lng, quality: quality, parentMallId: mall);

final places = [
  _p('a', 'cafe', 30.0000, 31.0000),
  _p('b', 'cafe', 30.0010, 31.0000, quality: 9), // ~110 m
  _p('c', 'restaurant', 30.0030, 31.0000), // ~330 m
  _p('d', 'cafe', 30.0200, 31.0000), // ~2.2 km
  _p('e', 'cafe', 30.1000, 31.0000), // ~11 km
  _p('s', 'shop', 30.0005, 31.0000, mall: 'm1'),
];

List<PlanStop> stops(List<String> ids) => buildStops(
    [for (final id in ids) ProposedStop(placeId: id, startTime: '18:00', durationMinutes: 60)], places);

void main() {
  test("what's nearby: within 500 m, nearest first, no unrelated shops", () {
    final near = nearbyPlaces(places.first, places);
    expect(near.map((p) => p.id), ['b', 'c']);
  });

  test('similar nearby: same category within 3 km, best documented first', () {
    final sim = similarNearby(places.first, places);
    expect(sim.map((p) => p.id), ['b', 'd']);
  });

  test('route summary adds real distances between stops', () {
    final r = routeSummary(stops(['a', 'c', 'd']))!;
    expect(r.km, closeTo(2.2, 0.1));
    expect(r.minutes, greaterThan(0));
    expect(routeSummary(stops(['a'])), isNull, reason: 'one stop has no route');
  });

  test('full route link includes every stop', () {
    final url = routeMapsUrl(stops(['a', 'c', 'd']))!;
    expect(url.queryParameters['origin'], '30.0,31.0');
    expect(url.queryParameters['destination'], '30.02,31.0');
    expect(url.queryParameters['waypoints'], '30.003,31.0');
  });

  test('move, remove and add stops keep distances right', () {
    final moved = moveStop(stops(['a', 'c', 'd']), 2, 0);
    expect(moved.map((s) => s.placeId), ['d', 'a', 'c']);
    expect(moved.first.kmFromPrevious, isNull);
    expect(moved[1].kmFromPrevious, closeTo(2.2, 0.1));

    final removed = removeStop(stops(['a', 'c', 'd']), 1);
    expect(removed.map((s) => s.placeId), ['a', 'd']);

    final added = addStop(stops(['a']), places[2]);
    expect(added.last.placeId, 'c');
    expect(added.last.startTime, '19:20', reason: 'after the last stop plus travel time');
  });

  test('a plan request remembers its day', () {
    const r = PlanRequest(city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening', date: '2026-12-25');
    expect(r.day, DateTime(2026, 12, 25));
    expect(PlanRequest.fromMap(r.toMap()).date, '2026-12-25');
    expect(r.copyWith(excludePlaceIds: ['x']).date, '2026-12-25');
  });
}
