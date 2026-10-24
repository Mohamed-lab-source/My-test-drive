import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/plan_list.dart';
import 'package:khroga/models/plan.dart';

OutingPlan _plan(String id, String? date, {String? start}) => OutingPlan(
      id: id,
      title: 'Test $id',
      summary: '',
      stops: [PlanStop(placeId: 'p', name: 'Test place', category: 'cafe', startTime: start)],
      request: PlanRequest(city: 'cairo', groupSize: 2, vibes: const ['chill'], timeOfDay: 'evening', stops: 1, date: date),
      tips: const [],
    );

void main() {
  test('upcoming plans: today and later, soonest first; the rest stays in the other list', () {
    final now = DateTime(2026, 10, 24, 15);
    final all = [
      _plan('later', '2026-10-30'),
      _plan('past', '2026-10-20'),
      _plan('today-late', '2026-10-24', start: '20:00'),
      _plan('any', null),
      _plan('today-early', '2026-10-24', start: '18:00'),
    ];
    expect(upcomingPlans(all, now).map((p) => p.id), ['today-early', 'today-late', 'later']);
    expect(todaysPlans(all, now).map((p) => p.id), ['today-early', 'today-late']);
    expect(otherPlans(all, now).map((p) => p.id), ['past', 'any']);
  });
}
