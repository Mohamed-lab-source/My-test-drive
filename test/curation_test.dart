// Test-only sample places (fake names on purpose, never shipped in the app).
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/planner/curation.dart';
import 'package:khroga/planner/planner.dart';

Place _p(String id, String category,
        {String? name,
        String city = 'cairo',
        double lat = 30.05,
        double lng = 31.23,
        int quality = 6,
        String? kind,
        String? cuisine,
        String? wikidata,
        String? hours}) =>
    Place(
        id: id,
        name: name ?? 'Test $id',
        category: category,
        city: city,
        lat: lat,
        lng: lng,
        quality: quality,
        kind: kind,
        cuisine: cuisine,
        wikidata: wikidata,
        openingHours: hours);

PlanRequest _req(List<String> vibes, String time, {int stops = 3}) =>
    PlanRequest(city: 'cairo', groupSize: 2, vibes: vibes, timeOfDay: time, stops: stops);

void main() {
  test('entries that are not somewhere to go out are left out', () {
    expect(isJunkPlace(_p('ov-1', 'sight', name: 'Test Real Estate', kind: 'historic site')), isTrue);
    expect(isJunkPlace(_p('ov-2', 'sight', name: 'Test Gardens Compound', kind: 'historic site')), isTrue);
    expect(isJunkPlace(_p('ov-3', 'sight', name: 'Test Heights', kind: 'historic site')), isTrue,
        reason: 'Overture "historic sites" need a landmark word');
    expect(isJunkPlace(_p('ov-4', 'sight', name: 'Test Palace', kind: 'palace')), isFalse);
    expect(isJunkPlace(_p('ov-5', 'cafe', name: 'Test Net', kind: 'internet cafe')), isTrue);
    expect(isJunkPlace(_p('ov-6', 'cafe', name: 'Circle K Test')), isTrue);
    expect(isJunkPlace(_p('osm-7', 'activity', name: 'Test Sporting Club', wikidata: 'Q1')), isTrue,
        reason: 'members-only clubs, even notable ones');
    expect(isJunkPlace(_p('ov-8', 'activity', name: 'Test Horse Club', kind: 'horse riding')), isFalse);
    expect(isJunkPlace(_p('ov-9', 'activity', name: 'Test Beach', kind: 'beach')), isTrue,
        reason: 'a beach in Cairo is an office');
    expect(isJunkPlace(_p('ov-10', 'activity', name: 'Test Beach', kind: 'beach', city: 'alexandria', lat: 31.25, lng: 29.97)),
        isFalse);
    expect(isJunkPlace(_p('ov-11', 'entertainment', name: 'Test Aqua Park', city: 'alexandria', lat: 30.83, lng: 28.95)),
        isTrue, reason: 'far outside Alexandria');
    expect(isJunkPlace(_p('ov-12', 'sight', name: 'Test Pyramid Tours', kind: 'historic site', lat: 30.06, lng: 31.21)),
        isTrue, reason: 'a pyramid pin in the city is a tour office');
    expect(isJunkPlace(_p('osm-13', 'restaurant', name: 'Test Bistro')), isFalse);
    expect(isJunkPlace(_p('osm-14', 'museum', name: 'Test Art Academy', kind: 'art gallery')), isTrue);
  });

  test('chains, quick bites and food roles', () {
    expect(chainKey('Test Burger - Branch One'), 'test burger');
    expect(chainKey('مطعم تست فرع المعادي'), 'تست');
    final list = [for (var i = 0; i < 5; i++) _p('c$i', 'restaurant', name: 'Test Chain - Area $i'), _p('solo', 'restaurant')];
    final sizes = chainSizes(list);
    expect(isChain(list.first, sizes), isTrue);
    expect(isChain(list.last, sizes), isFalse);
    expect(isQuickBite(_p('q', 'restaurant', kind: 'fast food restaurant')), isTrue);
    expect(isQuickBite(_p('q2', 'restaurant', cuisine: 'syrian;fast_food')), isTrue);
    expect(isQuickBite(_p('m', 'restaurant', kind: 'italian restaurant')), isFalse);
    expect(foodRole(_p('s', 'cafe', kind: 'ice cream shop')), 'sweet');
    expect(foodRole(_p('k', 'cafe', kind: 'coffee shop')), 'coffee');
    expect(isDaytimeOnly(_p('z', 'entertainment', name: 'Test Zoo')), isTrue);
    expect(isDaytimeOnly(_p('t', 'museum', kind: 'theatre venue')), isFalse);
  });

  test('romantic dinner prefers a proper restaurant over a chain burger', () {
    final places = [
      for (var i = 0; i < 5; i++)
        _p('ch$i', 'restaurant', name: 'Test Burgers - $i', kind: 'fast food restaurant', quality: 10, lat: 30.05 + i * 0.05),
      _p('nice', 'restaurant', name: 'Test Trattoria', kind: 'italian restaurant', quality: 7),
      _p('cin', 'cinema', name: 'Test Cinema', quality: 7, lat: 30.051),
      _p('cafe', 'cafe', name: 'Test Sweets', kind: 'dessert shop', quality: 7, lat: 30.052),
    ];
    final r = _req(['romantic'], 'evening');
    final c = pickCandidates(places, r, null, random: Random(1));
    expect(c.where((p) => p.name.startsWith('Test Burgers')).length, lessThanOrEqualTo(1), reason: 'one branch per chain');
    final plan = fallbackPlan(r, c, random: Random(1));
    expect(plan.stops.map((s) => s.placeId), ['cin', 'nice', 'cafe']);
  });

  test('a plan has one meal, no two of a kind in a row, and no zoo at night', () {
    final places = [
      _p('r1', 'restaurant', kind: 'egyptian restaurant', quality: 9),
      _p('r2', 'restaurant', kind: 'italian restaurant', quality: 9, lat: 30.051),
      _p('r3', 'restaurant', kind: 'seafood restaurant', quality: 9, lat: 30.052),
      _p('c1', 'cafe', kind: 'coffee shop', quality: 8, lat: 30.053),
      _p('c2', 'cafe', kind: 'dessert shop', quality: 8, lat: 30.054),
      _p('zoo', 'entertainment', name: 'Test Zoo', quality: 10, lat: 30.055),
      _p('bowl', 'entertainment', kind: 'bowling alley', quality: 6, lat: 30.056),
    ];
    for (final time in ['evening', 'night']) {
      final r = _req(['nightlife'], time);
      final c = pickCandidates(places, r, null, random: Random(2));
      final stops = fallbackPlan(r, c, random: Random(2)).stops;
      final cats = [for (final s in stops) places.firstWhere((p) => p.id == s.placeId).category];
      expect(cats.where((x) => x == 'restaurant').length, 1, reason: time);
      for (var i = 1; i < cats.length; i++) {
        expect(cats[i], isNot(cats[i - 1]));
      }
      expect(stops.map((s) => s.placeId), isNot(contains('zoo')));
    }
  });

  test('stops stay close and skip places closed when we get there', () {
    final places = [
      _p('fun', 'cinema', quality: 8),
      _p('farFood', 'restaurant', kind: 'italian restaurant', quality: 10, lat: 30.12),
      _p('nearFood', 'restaurant', kind: 'italian restaurant', quality: 6, lat: 30.051),
      _p('closedCafe', 'cafe', quality: 10, lat: 30.052, hours: 'Mo-Su 08:00-12:00'),
      _p('openCafe', 'cafe', quality: 5, lat: 30.053, hours: 'Mo-Su 10:00-24:00'),
    ];
    final r = _req(['romantic'], 'evening');
    final day = DateTime(2026, 11, 6);
    final c = pickCandidates(places, r, null, random: Random(3), now: day);
    final ids = fallbackPlan(r, c, day: day, random: Random(3)).stops.map((s) => s.placeId).toList();
    expect(ids, ['fun', 'nearFood', 'openCafe']);
  });
}
