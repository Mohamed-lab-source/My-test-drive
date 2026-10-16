import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/crowd.dart';

void main() {
  final now = DateTime(2026, 10, 16, 20);

  test('recent reports and the most reported level', () {
    expect(const CrowdNow().isRecent(now), isFalse);
    final c = CrowdNow(quiet: 1, normal: 2, busy: 2, since: now.subtract(const Duration(minutes: 40)));
    expect(c.isRecent(now), isTrue);
    expect(c.total, 5);
    expect(c.top, 'busy', reason: 'ties go to the busier level');
    expect(CrowdNow(quiet: 3, since: now).top, 'quiet');
    expect(CrowdNow(normal: 1, since: now.subtract(const Duration(hours: 3))).isRecent(now), isFalse);
    expect(crowdSummary(c), contains('2 of 5'));
  });

  test('a report continues the window or starts a new one', () {
    final fresh = CrowdNow(quiet: 1, normal: 0, busy: 2, since: now.subtract(const Duration(minutes: 30)));
    final old = CrowdNow(quiet: 1, normal: 4, busy: 2, since: now.subtract(const Duration(hours: 2, minutes: 10)));
    expect(crowdContinues(fresh, now), isTrue);
    expect(crowdContinues(old, now), isFalse);
    expect(crowdContinues(null, now), isFalse);
    expect(crowdCountsAfter(fresh, 'normal', continues: true), {'quiet': 1, 'normal': 1, 'busy': 2});
    expect(crowdCountsAfter(old, 'busy', continues: false), {'quiet': 0, 'normal': 0, 'busy': 1});
    expect(crowdCountsAfter(null, 'quiet', continues: false), {'quiet': 1, 'normal': 0, 'busy': 0});
  });

  test('one report per place every 30 minutes', () {
    expect(crowdMinutesLeft(null, now), 0);
    expect(crowdMinutesLeft(now.subtract(const Duration(minutes: 10)), now), 21);
    expect(crowdMinutesLeft(now.subtract(const Duration(minutes: 31)), now), 0);
  });
}
