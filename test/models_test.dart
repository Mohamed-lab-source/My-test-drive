import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/place.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/models/social.dart';

void main() {
  group('Place', () {
    test('missing facts stay null instead of being guessed', () {
      final p = Place.fromMap('x', {'name': 'Somewhere', 'category': 'cafe', 'city': 'cairo'});
      expect(p.lat, isNull);
      expect(p.hasLocation, isFalse);
      expect(p.avgCostPerPerson, isNull);
      expect(p.priceLabel, '');
    });

    test('price level label', () {
      expect(Place.fromMap('x', {'priceLevel': 0}).priceLabel, 'Free');
      expect(Place.fromMap('x', {'priceLevel': 3}).priceLabel, r'$$$');
    });

    test('ignores broken photo entries', () {
      final p = Place.fromMap('x', {
        'photos': [
          {'url': 'https://a/b.jpg', 'attribution': 'Someone'},
          {'attribution': 'no link'},
          'not a map',
        ],
      });
      expect(p.photos, hasLength(1));
    });
  });

  group('OutingPlan', () {
    test('budget only adds up known costs', () {
      final plan = OutingPlan.fromMap('p', {
        'title': 'T',
        'stops': [
          {'placeId': 'a', 'name': 'A', 'avgCostPerPerson': 200},
          {'placeId': 'b', 'name': 'B'},
        ],
        'request': {'city': 'cairo', 'mallId': 'mall1'},
      });
      expect(plan.knownCostPerPerson, 200);
      expect(plan.stopsWithUnknownCost, 1);
      expect(plan.isMallLocked, isTrue);
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
      expect(const PublicProfile(uid: 'u', displayName: 'mohamed ali').initials, 'MA');
      expect(const PublicProfile(uid: 'u', displayName: '  ').initials, '?');
    });
  });
}
