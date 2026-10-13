/// Weekly challenges: one small goal each week (the same for everyone),
/// worked out from your own reviews and plans. Pure, tested in
/// test/challenges_test.dart. Finished weeks are remembered on the phone.
library;

import '../models/plan.dart';
import '../models/review.dart';
import 'i18n.dart';

class Challenge {
  const Challenge(this.id, this.emoji, this._title, this.goal, this._count, {this.action = '/explore'});
  final String id;
  final String emoji;
  final String _title;
  String get title => tr(_title);
  final int goal;

  /// Counts progress from this week's reviews and plans.
  final int Function(List<Review> reviews, List<OutingPlan> plans) _count;
  int progress(List<Review> reviews, List<OutingPlan> plans) => _count(reviews, plans).clamp(0, goal);

  /// Where the "Go" button takes you.
  final String action;
}

int _reviewsOf(List<Review> r, Set<String> cats) => r.where((x) => cats.contains(x.category)).length;
int _plansWith(List<OutingPlan> p, String vibe) => p.where((x) => x.request.vibes.contains(vibe)).length;

final challenges = <Challenge>[
  Challenge('cafes', '☕', 'Review 2 cafés', 2, (r, p) => _reviewsOf(r, {'cafe'})),
  Challenge('culture', '🏛️', 'Make a Culture plan', 1, (r, p) => _plansWith(p, 'culture'), action: '/ideas'),
  Challenge('park', '🌳', 'Review a park or garden', 1, (r, p) => _reviewsOf(r, {'park'})),
  Challenge('three', '✍️', 'Write 3 reviews', 3, (r, p) => r.length),
  Challenge('family', '👨‍👩‍👧', 'Make a Family plan', 1, (r, p) => _plansWith(p, 'family'), action: '/ideas'),
  Challenge('food', '🍽️', 'Review 2 restaurants', 2, (r, p) => _reviewsOf(r, {'restaurant'})),
  Challenge('detailed', '🔎', 'Write a detailed review', 1, (r, p) => r.where((x) => x.isDetailed).length),
  Challenge('fun', '🎳', 'Review a fun place', 1,
      (r, p) => _reviewsOf(r, {'entertainment', 'escape_room', 'activity', 'cinema'})),
  Challenge('two_plans', '🗺️', 'Make 2 plans', 2, (r, p) => p.length, action: '/plan'),
  Challenge('mall', '🛍️', 'Review a mall', 1, (r, p) => _reviewsOf(r, {'mall'})),
];

/// Weeks start on Saturday (Egypt's week).
DateTime weekStart(DateTime now) {
  final d = DateTime(now.year, now.month, now.day);
  return d.subtract(Duration(days: (d.weekday - DateTime.saturday + 7) % 7));
}

/// "2026-W41"-style key for the week [now] is in (Saturday-based).
String weekKey(DateTime now) {
  final s = weekStart(now);
  return '${s.year}-${s.month.toString().padLeft(2, '0')}-${s.day.toString().padLeft(2, '0')}';
}

/// This week's challenge (everyone gets the same one).
Challenge challengeFor(DateTime now) {
  final weeks = weekStart(now).difference(DateTime(2026, 1, 3)).inDays ~/ 7;
  return challenges[weeks % challenges.length];
}

/// Only what happened since this week started counts.
(List<Review>, List<OutingPlan>) thisWeek(List<Review> reviews, List<OutingPlan> plans, DateTime now) {
  final start = weekStart(now);
  bool inWeek(DateTime? t) => t != null && !t.isBefore(start);
  return (
    reviews.where((r) => inWeek(r.updatedAt)).toList(),
    plans.where((p) => inWeek(p.createdAt)).toList(),
  );
}
