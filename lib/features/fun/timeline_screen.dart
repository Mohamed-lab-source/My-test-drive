import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

/// Your outings as a diary: every place you marked "Been there", by month,
/// with the stars you gave it (on this phone).
class TimelineScreen extends ConsumerWidget {
  const TimelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final stars = ref.watch(myRatingsProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('My timeline'))),
      body: AsyncView<List<(Place, DateTime?)>>(
        value: ref.watch(visitedDatedProvider),
        onRetry: () => ref.invalidate(visitedDatedProvider),
        builder: (visited) {
          final dated = [
            for (final v in visited)
              if (v.$2 != null) (v.$1, v.$2!),
          ];
          if (dated.isEmpty) {
            return EmptyState(
              emoji: '📔',
              title: tr('Your timeline is empty'),
              message: tr('Tap "Been there" on a place page and it shows up here with the date.'),
              actionLabel: tr('Explore places'),
              onAction: () => context.go('/explore'),
            );
          }
          final plans = ref.watch(recentPlansProvider).value ?? const <OutingPlan>[];
          final days = activityDays([
            for (final (_, t) in dated) t,
            ...plans.map((p) => p.createdAt).whereType<DateTime>(),
          ], DateTime.now());
          String? lastMonth;
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              Text(tr('Last 12 weeks'), style: text.titleSmall),
              const SizedBox(height: KSpace.xs),
              ActivityGrid(days: days),
              const SizedBox(height: KSpace.sm),
              for (final (p, t) in dated) ...[
                if (DateFormat.yMMMM().format(t) case final m when m != lastMonth) ...[SectionTitle(lastMonth = m)],
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: SizedBox(
                    width: 44,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(DateFormat.d().format(t), style: text.titleMedium),
                        Text(DateFormat.E().format(t), style: text.bodySmall),
                      ],
                    ),
                  ),
                  title: Text('${Categories.emoji(p.category)} ${p.shownName}'),
                  subtitle: Text([if (p.area != null) p.area!, if (stars[p.id] case final s?) '★' * s].join(' · ')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/place/${p.id}'),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// A GitHub-style grid: one square per day, darker = more going on.
class ActivityGrid extends StatelessWidget {
  const ActivityGrid({super.key, required this.days});

  /// Oldest first; length is a multiple of 7.
  final List<int> days;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final weeks = (days.length / 7).ceil();
    final active = days.where((d) => d > 0).length;
    return Semantics(
      label: trf('{n} active days in the last 12 weeks', {'n': active}),
      child: LayoutBuilder(
        builder: (context, box) {
          final cell = ((box.maxWidth - (weeks - 1) * 3) / weeks).clamp(6.0, 18.0);
          return Row(
            children: [
              for (var w = 0; w < weeks; w++)
                Padding(
                  padding: EdgeInsetsDirectional.only(end: w == weeks - 1 ? 0 : 3),
                  child: Column(
                    children: [
                      for (var d = 0; d < 7; d++)
                        if (w * 7 + d < days.length)
                          Container(
                            width: cell,
                            height: cell,
                            margin: const EdgeInsets.only(bottom: 3),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(3),
                              color: days[w * 7 + d] == 0
                                  ? k.accentSoft
                                  : k.accent.withValues(alpha: (0.45 + 0.2 * days[w * 7 + d]).clamp(0.45, 1.0)),
                            ),
                          ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// "A month ago you were at …": a memory from your own "Been there" dates.
class OnThisDayCard extends ConsumerWidget {
  const OnThisDayCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visited = ref.watch(visitedDatedProvider).value;
    if (visited == null) return const SizedBox.shrink();
    final memory = onThisDay(visited, DateTime.now());
    if (memory == null) return const SizedBox.shrink();
    final (p, months) = memory;
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: ListTile(
        leading: const Text('📸', style: TextStyle(fontSize: 26)),
        title: Text(
          months == 12
              ? tr('A year ago today')
              : months == 1
              ? tr('A month ago today')
              : trf('{n} months ago today', {'n': months}),
        ),
        subtitle: Text(trf('You were at {place}. Go again?', {'place': p.shownName})),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/place/${p.id}'),
      ),
    );
  }
}
