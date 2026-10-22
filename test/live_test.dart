// Test-only fake places (never shipped in the app).
import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/live.dart';
import 'package:khroga/data/live_share.dart' show SavedTrack, savedTracks;
import 'package:khroga/models/place.dart';

Place _p(String id, String cat, double lat, double lng, {int quality = 5, String city = 'cairo'}) =>
    Place(id: id, name: 'Test $id', category: cat, city: city, lat: lat, lng: lng, quality: quality);

void main() {
  test('live spots expire and need fresh updates', () {
    final now = DateTime(2026, 10, 22, 18);
    final s = LiveSpot(
        uid: 'a', name: 'A', lat: 30, lng: 31, updatedAt: now.subtract(const Duration(minutes: 3)),
        until: now.add(const Duration(hours: 1)));
    expect(s.isLive(now), isTrue);
    expect(s.isLive(now.add(const Duration(minutes: 20))), isFalse, reason: 'not heard from');
    expect(s.isLive(now.add(const Duration(hours: 2))), isFalse, reason: 'sharing ended');
    final m = LiveSpot.fromMap('b', {'lat': 30.0, 'lng': 31.0, 'name': 'B', 'updatedAt': now, 'until': now, 'status': 'way'});
    expect(m!.status, 'way');
    expect(LiveSpot.fromMap('c', {'lat': 'x'}), isNull);
    expect(liveDurations.last, 240, reason: 'the rules allow at most 4 hours');
  });

  test('positions are sent only when worth it', () {
    final t = DateTime(2026, 10, 22, 18);
    expect(shouldSendLive(lastPoint: null, lastAt: null, point: (30, 31), now: t), isTrue);
    const here = (30.0, 31.0);
    const near = (30.0001, 31.0); // ~11 m
    const moved = (30.001, 31.0); // ~111 m
    expect(shouldSendLive(lastPoint: here, lastAt: t, point: moved, now: t.add(const Duration(seconds: 10))), isFalse);
    expect(shouldSendLive(lastPoint: here, lastAt: t, point: moved, now: t.add(const Duration(seconds: 30))), isTrue);
    expect(shouldSendLive(lastPoint: here, lastAt: t, point: near, now: t.add(const Duration(seconds: 30))), isFalse);
    expect(shouldSendLive(lastPoint: here, lastAt: t, point: near, now: t.add(const Duration(minutes: 3))), isTrue);
  });

  test('rough times, arriving and a fair middle', () {
    expect(roughEtaMinutes(1.2), 15);
    expect(roughEtaMinutes(0.01), 1);
    expect(roughEtaMinutes(11), 45);
    expect(hasArrived(0.1), isTrue);
    expect(hasArrived(0.3), isFalse);
    expect(fairMidpoint(const []), isNull);
    expect(fairMidpoint(const [(30.0, 31.0), (30.2, 31.4)]), (30.1, 31.2));
  });

  test('meeting spots: real places near the middle, best documented first', () {
    final places = [
      _p('cafe-near', 'cafe', 30.001, 31.0, quality: 3),
      _p('cafe-best', 'cafe', 30.005, 31.0, quality: 9),
      _p('far', 'cafe', 30.2, 31.0, quality: 9),
      _p('shop', 'shop', 30.0, 31.0, quality: 9),
      _p('alex', 'cafe', 30.0, 31.0, quality: 9, city: 'alexandria'),
    ];
    expect(meetingSpots(places, (30.0, 31.0), city: 'cairo').map((p) => p.id), ['cafe-best', 'cafe-near']);
  });

  test('track: jitter and impossible jumps are skipped, distance adds up', () {
    final t = DateTime(2026, 10, 22, 18);
    var pts = <TrackPoint>[];
    pts = addTrackPoint(pts, (lat: 30.0, lng: 31.0, at: t));
    pts = addTrackPoint(pts, (lat: 30.00005, lng: 31.0, at: t.add(const Duration(seconds: 5))));
    expect(pts.length, 1, reason: '5 m of GPS jitter');
    pts = addTrackPoint(pts, (lat: 30.009, lng: 31.0, at: t.add(const Duration(minutes: 12))));
    expect(pts.length, 2);
    pts = addTrackPoint(pts, (lat: 31.0, lng: 31.0, at: t.add(const Duration(minutes: 13))));
    expect(pts.length, 2, reason: '110 km in a minute is a GPS glitch');
    expect(trailKm(pts), closeTo(1.0, 0.02));
    expect(averageKmh(pts), closeTo(5.0, 0.2));
    final many = [for (var i = 0; i < 100; i++) (lat: 30 + i * 0.0001, lng: 31.0, at: t.add(Duration(seconds: i * 10)))];
    final thin = thinTrail(many);
    expect(thin.first, many.first);
    expect(thin.last, many.last);
    expect(thin.length, lessThan(30));
    expect(trackDuration(const Duration(minutes: 65)), '1 h 05 min');
    expect(trackDuration(const Duration(minutes: 7)), '7 min');
  });

  test('saved routes survive a round trip and bad data is skipped', () {
    final t = DateTime(2026, 10, 22, 18);
    final track = SavedTrack(started: t, title: 'Test walk', points: [
      (lat: 30.0, lng: 31.0, at: t),
      (lat: 30.009, lng: 31.0, at: t.add(const Duration(minutes: 12))),
    ]);
    final back = SavedTrack.fromJson(track.toJson())!;
    expect(back.title, 'Test walk');
    expect(back.points.length, 2);
    expect(back.km, closeTo(1.0, 0.02));
    expect(savedTracks('not json'), isEmpty);
    expect(savedTracks('[{"started": "x"}, 5]'), isEmpty);
  });
}
