import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/challenges.dart';
import 'package:khroga/models/plan.dart';
import 'package:khroga/models/review.dart';

Review rv(String cat, DateTime t, {bool detailed = false}) => Review(
    placeId: 'p$t', uid: 'u', name: 'Test', stars: 4, category: cat, updatedAt: t,
    text: detailed ? 'x' * 60 : '', answers: detailed ? const {'a': '1', 'b': '2', 'c': '3'} : const {});

OutingPlan pl(List<String> vibes, DateTime t) => OutingPlan(
    id: 'x', title: 'T', summary: '', stops: const [], createdAt: t,
    request: PlanRequest(city: 'cairo', groupSize: 2, vibes: vibes, timeOfDay: 'evening'));

void main() {
  test('weeks start on Saturday and every week has one challenge', () {
    expect(weekStart(DateTime(2026, 10, 13)), DateTime(2026, 10, 10)); // Tue → Sat
    expect(weekStart(DateTime(2026, 10, 10, 23)), DateTime(2026, 10, 10));
    expect(weekKey(DateTime(2026, 10, 16)), '2026-10-10');
    final a = challengeFor(DateTime(2026, 10, 13));
    expect(challengeFor(DateTime(2026, 10, 16)).id, a.id); // same week
    expect(challengeFor(DateTime(2026, 10, 17)).id, isNot(a.id)); // next week
  });

  test('only this week counts, and progress stops at the goal', () {
    final now = DateTime(2026, 10, 13);
    final reviews = [
      rv('cafe', DateTime(2026, 10, 11)),
      rv('cafe', DateTime(2026, 10, 12)),
      rv('cafe', DateTime(2026, 10, 12, 5)),
      rv('cafe', DateTime(2026, 10, 1)), // last week
    ];
    final (r, p) = thisWeek(reviews, [pl(['culture'], DateTime(2026, 10, 12)), pl(['culture'], DateTime(2026, 9, 1))], now);
    expect(r.length, 3);
    expect(p.length, 1);
    final cafes = challenges.firstWhere((c) => c.id == 'cafes');
    expect(cafes.progress(r, p), 2);
    expect(challenges.firstWhere((c) => c.id == 'culture').progress(r, p), 1);
    expect(challenges.firstWhere((c) => c.id == 'detailed').progress(r, p), 0);
  });
}
