import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/challenges.dart';
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../models/review.dart';

/// Your reviews since this week started (one small query).
final myWeekReviewsProvider = FutureProvider.autoDispose<List<Review>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Future.value(const []);
  return ref.watch(reviewsRepositoryProvider).mineSince(uid, weekStart(DateTime.now()));
});

/// "This week's challenge: Review 2 cafés · 1/2", with a Go button.
class ChallengeCard extends ConsumerWidget {
  const ChallengeCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final c = challengeFor(now);
    final (reviews, plans) = thisWeek(
      ref.watch(myWeekReviewsProvider).value ?? const [],
      ref.watch(recentPlansProvider).value ?? const <OutingPlan>[],
      now,
    );
    final progress = c.progress(reviews, plans);
    final done = progress >= c.goal;
    final finished = ref.watch(challengesDoneProvider);
    final key = weekKey(now);
    if (done && finished[key] == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => ref.read(challengesDoneProvider.notifier).set(key, c.id));
    }
    final text = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Row(children: [
          Text(done ? '🏆' : c.emoji, style: const TextStyle(fontSize: 30)),
          const SizedBox(width: KSpace.md),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(tr('This week\'s challenge'), style: text.labelMedium?.copyWith(color: context.k.accent)),
              Text(c.title, style: text.titleMedium),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(value: progress / c.goal, minHeight: 8),
              ),
              const SizedBox(height: 4),
              Text(
                done
                    ? trf('Done! {n} challenges finished so far.', {'n': finished.length + (finished[key] == null ? 1 : 0)})
                    : trf('{n} of {g} · a new one every Saturday', {'n': progress, 'g': c.goal}),
                style: text.bodySmall,
              ),
            ]),
          ),
          if (!done) TextButton(onPressed: () => context.push(c.action), child: Text(tr('Go'))),
        ]),
      ),
    );
  }
}
