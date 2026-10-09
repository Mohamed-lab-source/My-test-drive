import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/links.dart';
import 'package:khroga/app/review.dart';

void main() {
  const host = 'example-test.web.app';

  test('place, group and friend links map to app screens', () {
    expect(appRouteFor(placeLink(host, 'ov-abc_123')), '/place/ov-abc_123');
    expect(appRouteFor(groupLink(host, 'ab12cd')), '/join/AB12CD');
    expect(appRouteFor(friendLink(host, 'UidOfSomeone123')), '/add-friend/UidOfSomeone123');
    expect(appRouteFor(appLink(host)), '/plan');
    expect(appRouteFor(Uri.parse('https://$host/privacy.html')), isNull);
    expect(appRouteFor(Uri.parse('https://$host/j/no!')), isNull);
    expect(appRouteFor(Uri.parse('https://$host/u/x')), isNull);
  });

  test('a shared plan survives the link, odd parts are dropped', () {
    final link = planLink(host, (
      city: 'cairo',
      title: 'Test Friday plan',
      date: '2026-10-09',
      stops: [
        (placeId: 'osm-node-1', time: '18:00', minutes: 90),
        (placeId: 'ov-2', time: null, minutes: null),
      ],
    ));
    final back = parsePlanLink(link)!;
    expect(back.city, 'cairo');
    expect(back.title, 'Test Friday plan');
    expect(back.date, '2026-10-09');
    expect(back.stops.length, 2);
    expect(back.stops.first.time, '18:00');
    expect(back.stops.first.minutes, 90);
    expect(back.stops.last.time, isNull);
    expect(appRouteFor(link), startsWith('/shared?'));

    final odd = Uri.parse('https://$host/s?c=cairo&t=x&d=tomorrow&s=a~25:99~5|b~10:00~9999|'
        '|c|d|e|f|g');
    final p = parsePlanLink(odd)!;
    expect(p.date, isNull);
    expect(p.stops.length, 5);
    expect(p.stops[0].time, isNull);
    expect(p.stops[0].minutes, isNull);
    expect(p.stops[1].minutes, isNull);
    expect(parsePlanLink(Uri.parse('https://$host/s?c=paris&s=a')), isNull);
    expect(parsePlanLink(Uri.parse('https://$host/s?c=cairo&s=')), isNull);
  });

  test('the rating box only comes after happy moments, rarely', () {
    final now = DateTime(2026, 10, 9);
    expect(shouldAskForReview(moments: 2, now: now), isFalse);
    expect(shouldAskForReview(moments: 3, now: now), isTrue);
    expect(shouldAskForReview(moments: 5, lastAsked: now.subtract(const Duration(days: 30)), now: now), isFalse);
    expect(shouldAskForReview(moments: 5, lastAsked: now.subtract(const Duration(days: 91)), now: now), isTrue);
  });
}
