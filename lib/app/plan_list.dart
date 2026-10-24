import '../models/plan.dart';

/// Sorting plans for "My plans" (tested in test/plan_list_test.dart).

DateTime _dayOf(DateTime d) => DateTime(d.year, d.month, d.day);

/// Plans set for today or later, soonest first.
List<OutingPlan> upcomingPlans(List<OutingPlan> all, DateTime now) {
  final today = _dayOf(now);
  return [
    for (final p in all)
      if (p.request.date != null && !_dayOf(p.request.day).isBefore(today)) p,
  ]..sort((a, b) {
      final d = a.request.day.compareTo(b.request.day);
      if (d != 0) return d;
      return (a.stops.firstOrNull?.startTime ?? '').compareTo(b.stops.firstOrNull?.startTime ?? '');
    });
}

/// Plans for today (the first one is "today's plan").
List<OutingPlan> todaysPlans(List<OutingPlan> all, DateTime now) =>
    upcomingPlans(all, now).where((p) => _dayOf(p.request.day) == _dayOf(now)).toList();

/// Everything else: no day set, or a day that has passed (newest first).
List<OutingPlan> otherPlans(List<OutingPlan> all, DateTime now) {
  final upcoming = upcomingPlans(all, now).map((p) => p.id).toSet();
  return [
    for (final p in all)
      if (!upcoming.contains(p.id)) p,
  ];
}
