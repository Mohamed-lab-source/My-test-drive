import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/models/social.dart';

void main() {
  group('Place', () {
    test('missing facts stay null instead of being guessed', () {
      final p = Place.fromMap({'id': 'x', 'name': 'Somewhere', 'category': 'cafe', 'city': 'cairo'});
      expect(p.lat, isNull);
      expect(p.hasLocation, isFalse);
      expect(p.openingHours, isNull);
      expect(p.cuisineLabel, isNull);
    });

    test('cuisine label is readable', () {
      final p = Place.fromMap({'id': 'x', 'cuisine': 'pizza;italian;fast_food;burger'});
      expect(p.cuisineLabel, 'pizza, italian, fast food');
    });
  });

  group('OutingPlan', () {
    test('saving and loading keeps every field', () {
      const plan = OutingPlan(
        id: 'p',
        title: 'T',
        summary: 'S',
        stops: [PlanStop(placeId: 'a', name: 'A', category: 'cafe', lat: 30, lng: 31, startTime: '18:00')],
        request: PlanRequest(
            city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening', mallId: 'm1'),
        tips: ['Book ahead'],
        source: 'fallback',
      );
      final back = OutingPlan.fromMap('p', plan.toMap());
      expect(back.stops.single.lat, 30);
      expect(back.stops.single.startTime, '18:00');
      expect(back.isMallLocked, isTrue);
      expect(back.source, 'fallback');
      expect(back.tips, ['Book ahead']);
    });

    test('regenerating keeps mall mode', () {
      const r = PlanRequest(
          city: 'cairo', groupSize: 2, vibes: ['chill'], timeOfDay: 'evening', mallId: 'm1');
      final again = r.copyWith(excludePlaceIds: ['a']);
      expect(again.mallId, 'm1');
      expect(again.excludePlaceIds, ['a']);
    });
  });

  group('Social', () {
    test('friendship id is the same whoever sends the request', () {
      expect(Friendship.idFor('b', 'a'), Friendship.idFor('a', 'b'));
    });

    test('who pays excludes free members and people not going', () {
      final g = Group.fromMap('g', {
        'memberUids': ['a', 'b', 'c', 'd'],
        'rsvp': {'a': 'going', 'b': 'going', 'c': 'maybe', 'd': 'bogus'},
        'freeUids': ['b'],
      });
      expect(g.payingUids, ['a']);
      expect(g.rsvp.containsKey('d'), isFalse);
    });

    test('initials', () {
      expect(const PublicProfile(uid: 'u', displayName: 'sara ali').initials, 'SA');
      expect(const PublicProfile(uid: 'u', displayName: '  ').initials, '?');
    });
  });
}
