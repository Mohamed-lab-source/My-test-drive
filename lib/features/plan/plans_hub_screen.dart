import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/extras.dart' show daysUntilText;
import '../../app/i18n.dart';
import '../../app/plan_list.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/large_title.dart';
import '../../widgets/launchers.dart' show openDirections;
import '../../widgets/motion.dart';
import 'plan_actions.dart';

/// "My plans": today's outing up top, then Upcoming / Saved / All, each plan
/// one tap from everything you can do with it.
class PlansHubScreen extends ConsumerStatefulWidget {
  const PlansHubScreen({super.key});

  @override
  ConsumerState<PlansHubScreen> createState() => _PlansHubScreenState();
}

class _PlansHubScreenState extends ConsumerState<PlansHubScreen> {
  int _tab = 0; // 0 upcoming, 1 saved, 2 all
  int _limit = 40;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final all = ref.watch(historyPlansProvider(_limit));
    final saved = ref.watch(savedPlansProvider).value ?? const <OutingPlan>[];
    final plans = all.value ?? const <OutingPlan>[];
    final today = todaysPlans(plans, now);
    final shown = switch (_tab) {
      0 => upcomingPlans(plans, now),
      1 => saved,
      _ => plans,
    };
    final k = context.k;
    final text = Theme.of(context).textTheme;

    return KScaffold(
      title: Text(tr('My plans')),
      actions: [
        IconButton(
          tooltip: tr('New plan'),
          icon: const Icon(Icons.add_circle_outline),
          onPressed: () => context.go('/plan'),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          if (today.isNotEmpty) ...[
            FadeSlideIn(child: _TodayCard(plan: today.first)),
            const SizedBox(height: KSpace.md),
          ],
          SizedBox(
            width: double.infinity,
            child: CupertinoSlidingSegmentedControl<int>(
              groupValue: _tab,
              backgroundColor: k.surfaceHigh,
              thumbColor: k.surface,
              padding: const EdgeInsets.all(3),
              onValueChanged: (v) => setState(() => _tab = v ?? 0),
              children: {
                for (final (i, label) in [tr('Upcoming'), tr('Saved'), tr('All')].indexed)
                  i: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(label,
                        style: TextStyle(
                          fontFamily: KFont.body,
                          fontWeight: _tab == i ? FontWeight.w700 : FontWeight.w500,
                          color: k.ink,
                          fontSize: 14,
                        )),
                  ),
              },
            ),
          ),
          const SizedBox(height: KSpace.md),
          if (all.isLoading && plans.isEmpty)
            const SkeletonList(rows: 3)
          else if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.lg),
              child: EmptyState(
                emoji: switch (_tab) { 0 => '📅', 1 => '🔖', _ => '🗺️' },
                title: switch (_tab) {
                  0 => tr('Nothing coming up'),
                  1 => tr('No saved plans yet'),
                  _ => tr('No plans yet'),
                },
                message: switch (_tab) {
                  0 => tr('Plans with a day set show up here, soonest first.'),
                  1 => tr('Tap "Save" on a plan you like and it will show up here.'),
                  _ => tr('Every plan you make shows up here.'),
                },
                actionLabel: tr('Plan an outing'),
                onAction: () => context.go('/plan'),
              ),
            )
          else ...[
            for (final (i, p) in shown.indexed)
              FadeSlideIn(
                key: ValueKey('${_tab}_${p.id}'),
                index: i < 8 ? i : 0,
                child: PlanCard(plan: p),
              ),
            if (_tab == 2 && plans.length >= _limit)
              Center(
                child: TextButton(
                  onPressed: () => setState(() => _limit += 40),
                  child: Text(tr('Show older plans')),
                ),
              ),
          ],
          const SizedBox(height: KSpace.md),
          Text(tr('Tip: press and hold a plan for everything you can do with it.'),
              textAlign: TextAlign.center, style: text.bodySmall),
        ],
      ),
    );
  }
}

/// Today's outing: its first stop and a big button to get going.
class _TodayCard extends StatelessWidget {
  const _TodayCard({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final k = context.k;
    final text = Theme.of(context).textTheme;
    final first = plan.stops.firstOrNull;
    return HeroCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: k.signal, shape: BoxShape.circle),
          ),
          const SizedBox(width: KSpace.sm),
          Text(tr('Today'), style: TextStyle(color: k.onHero, fontWeight: FontWeight.w700)),
        ]),
        const SizedBox(height: KSpace.sm),
        Text(plan.title, style: text.headlineSmall?.copyWith(color: k.onHero), maxLines: 2, overflow: TextOverflow.ellipsis),
        if (first != null) ...[
          const SizedBox(height: KSpace.xs),
          Text(
            [
              if (first.startTime != null) first.startTime!,
              first.name,
              trf('{n} stops', {'n': plan.stops.length}),
            ].join(' · '),
            style: TextStyle(color: k.onHero.withValues(alpha: 0.9)),
          ),
        ],
        const SizedBox(height: KSpace.md),
        Row(children: [
          Expanded(
            child: FilledButton(
              style: FilledButton.styleFrom(backgroundColor: k.surface, foregroundColor: k.ink),
              onPressed: () => context.push('/plan/${plan.id}'),
              child: Text(tr('Open')),
            ),
          ),
          if (first != null && first.hasLocation) ...[
            const SizedBox(width: KSpace.sm),
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: k.onHero,
                  side: BorderSide(color: k.onHero.withValues(alpha: 0.6)),
                ),
                onPressed: () => openDirections(lat: first.lat!, lng: first.lng!),
                icon: const Icon(Icons.navigation_outlined, size: 18),
                label: Text(tr('Go')),
              ),
            ),
          ],
        ]),
      ]),
    );
  }
}

/// A plan in a list: a date badge, title, stops, and "…" for actions.
class PlanCard extends ConsumerWidget {
  const PlanCard({super.key, required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final text = Theme.of(context).textTheme;
    final dated = plan.request.date != null;
    final day = plan.request.day;
    final emojis = plan.stops.take(4).map((s) => Categories.emoji(s.category)).join(' ');
    final area = plan.stops.map((s) => s.area).whereType<String>().firstOrNull;
    final countdown = dated ? daysUntilText(day, DateTime.now()) : null;
    return Padding(
      padding: const EdgeInsets.only(bottom: KSpace.sm + 2),
      child: Pressable(
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () => context.push('/plan/${plan.id}'),
            onLongPress: () => showPlanActions(context, ref, plan),
            child: Padding(
              padding: const EdgeInsets.all(KSpace.sm + 4),
              child: Row(children: [
                Container(
                  width: 58,
                  height: 64,
                  decoration: BoxDecoration(color: k.surfaceHigh, borderRadius: BorderRadius.circular(16)),
                  alignment: Alignment.center,
                  child: dated
                      ? Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                          Text(DateFormat('MMM').format(day).toUpperCase(),
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: k.signal)),
                          Text('${day.day}',
                              style: TextStyle(
                                fontFamily: KFont.dots,
                                fontFamilyFallback: KFont.dotsFallback,
                                fontWeight: FontWeight.w900,
                                fontSize: 26,
                                height: 1.05,
                                color: k.ink,
                              )),
                        ])
                      : Text(plan.stops.isEmpty ? '🗺️' : Categories.emoji(plan.stops.first.category),
                          style: const TextStyle(fontSize: 26)),
                ),
                const SizedBox(width: KSpace.md),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Flexible(
                        child: Text(plan.title,
                            style: text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      if (plan.saved)
                        Padding(
                          padding: const EdgeInsetsDirectional.only(start: 4),
                          child: Icon(Icons.bookmark, size: 16, color: k.inkMuted),
                        ),
                    ]),
                    const SizedBox(height: 2),
                    Text(
                      [
                        '$emojis  ${trf('{n} stops', {'n': plan.stops.length})}',
                        ?area,
                        if (dated) DateFormat('EEE').format(day),
                        ?plan.stops.firstOrNull?.startTime,
                      ].join(' · '),
                      style: text.bodySmall,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (countdown != null) ...[
                      const SizedBox(height: 4),
                      Pill(countdown, color: k.accentSoft, textColor: k.ink),
                    ],
                  ]),
                ),
                IconButton(
                  tooltip: tr('More'),
                  icon: Icon(Icons.more_horiz, color: k.inkMuted),
                  onPressed: () => showPlanActions(context, ref, plan),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
