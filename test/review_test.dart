import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/models/review.dart';

Review r(int stars, {String cat = 'cafe', String text = '', Map<String, String> answers = const {}}) =>
    Review(placeId: 'p', uid: 'u', name: 'Test', stars: stars, category: cat, text: text, answers: answers);

void main() {
  test('points: 10 per review, 20 when detailed', () {
    expect(r(4).points, 10);
    expect(r(4, text: 'x' * 50, answers: {'a': '1', 'b': '2', 'c': '3'}).points, 20);
    expect(r(4, text: 'x' * 49, answers: {'a': '1', 'b': '2', 'c': '3'}).points, 10);
  });

  test('stats move by exactly one review (what the rules check)', () {
    const p0 = PlaceStats(), s0 = ReviewerStats();
    final detailed = r(5, text: 'y' * 60, answers: {'a': '1', 'b': '2', 'c': '3'});
    var (p, s) = statsAfter(p0, s0, null, detailed);
    expect((p.count, p.sum, s.total, s.detailed), (1, 5, 1, 1));
    expect(s.cats, {'cafe': 1});
    expect(s.points, 20);
    (p, s) = statsAfter(p, s, detailed, r(2));
    expect((p.count, p.sum, s.total, s.detailed), (1, 2, 1, 0));
    expect(s.cats, {'cafe': 1});
    (p, s) = statsAfter(p, s, r(2), null);
    expect((p.count, p.sum, s.total, s.detailed), (0, 0, 0, 0));
    expect(s.cats, <String, int>{});
    expect(PlaceStats.fromMap({'count': 4, 'sum': 18}).average, 4.5);
    expect(const PlaceStats().average, isNull);
  });

  test('levels and next level', () {
    expect(tierFor(0).name, 'Newcomer');
    expect(tierFor(100).name, 'Local Guide');
    expect(tierFor(260).name, 'Advanced Guide');
    expect(nextTier(90)!.$2, 10);
    expect(nextTier(5000), isNull);
  });

  test('expert badges need enough reviews of a kind, and half of all', () {
    var s = const ReviewerStats(total: 12, cats: {'restaurant': 6, 'cafe': 5, 'park': 1});
    expect(expertBadgesFor(s).map((b) => b.name), contains('Food expert'));
    s = const ReviewerStats(total: 40, cats: {'restaurant': 6, 'cafe': 5, 'park': 29});
    expect(expertBadgesFor(s).map((b) => b.name), isNot(contains('Food expert')));
    expect(expertBadgesFor(s).map((b) => b.name), contains('Outdoors expert'));
    expect(guideTitle(const ReviewerStats(total: 12, detailed: 0, cats: {'cafe': 12})), contains('Local Guide'));
  });

  test('questions are well formed for every kind of place', () {
    for (final cat in ['restaurant', 'cafe', 'cinema', 'mall', 'shop', 'park', 'museum', 'sight',
        'entertainment', 'escape_room', 'activity', 'other']) {
      final qs = reviewQuestionsFor(cat);
      expect(qs.length, lessThanOrEqualTo(20));
      expect(qs.map((q) => q.key).toSet().length, qs.length, reason: cat);
      for (final q in qs) {
        expect(q.options, isNotEmpty);
      }
    }
    expect(reviewQuestionsFor('restaurant').map((q) => q.key), contains('taste'));
  });

  test('answer summaries count each choice', () {
    final list = [
      r(5, answers: {'again': 'yes', 'goodFor': 'friends,dates'}),
      r(3, answers: {'again': 'no', 'goodFor': 'friends'}),
      r(4),
    ];
    expect(answerCounts(list, 'again'), {'yes': 1, 'no': 1});
    expect(answerCounts(list, 'goodFor'), {'friends': 2, 'dates': 1});
  });
}
