import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import '../groups/create_group_sheet.dart';
import 'plan_form_screen.dart';

class PlanResultScreen extends ConsumerWidget {
  const PlanResultScreen({super.key, required this.planId});

  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plan = ref.watch(planProvider(planId));
    return Scaffold(
      appBar: AppBar(title: const Text('Your plan')),
      body: AsyncView<OutingPlan?>(
        value: plan,
        onRetry: () => ref.invalidate(planProvider(planId)),
        builder: (p) => p == null
            ? const EmptyState(emoji: '🗺️', title: 'This plan was deleted')
            : _PlanBody(plan: p),
      ),
    );
  }
}

class _PlanBody extends ConsumerWidget {
  const _PlanBody({required this.plan});

  final OutingPlan plan;

  Future<void> _regenerate(BuildContext context, WidgetRef ref) async {
    // Keep everything the person asked for (including mall-only mode) and
    // avoid the places we just showed them.
    final exclude = {
      ...plan.request.excludePlaceIds,
      ...plan.stops.map((s) => s.placeId),
    }.toList();
    final id = await runPlanGeneration(
        context, ref, plan.request.copyWith(excludePlaceIds: exclude));
    if (id != null && context.mounted) context.pushReplacement('/plan/$id');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final uid = ref.watch(uidProvider)!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
      children: [
        Text(plan.title, style: text.headlineMedium),
        const SizedBox(height: KSpace.sm),
        if (plan.summary.isNotEmpty)
          Text(plan.summary,
              style: text.bodyLarge?.copyWith(color: KColors.inkMuted)),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            Pill('${plan.request.groupSize} '
                '${plan.request.groupSize == 1 ? 'person' : 'people'}'),
            Pill(Cities.all[plan.request.city] ?? plan.request.city),
            Pill(TimesOfDay.all[plan.request.timeOfDay] ?? plan.request.timeOfDay),
            if (plan.isMallLocked) const Pill('🛍️ One mall'),
          ],
        ),
        if (plan.weatherNote != null) ...[
          const SizedBox(height: KSpace.md),
          _InfoBanner(icon: Icons.wb_sunny_outlined, text: plan.weatherNote!),
        ],
        if (plan.source == 'fallback') ...[
          const SizedBox(height: KSpace.md),
          const _InfoBanner(
            icon: Icons.info_outline,
            text: 'Our AI planner was busy or offline, so we picked '
                'well-known matching places for you. Tap "Another one" to try again.',
          ),
        ],
        const SizedBox(height: KSpace.lg),
        for (var i = 0; i < plan.stops.length; i++)
          _StopTile(
            stop: plan.stops[i],
            index: i,
            isFirst: i == 0,
            isLast: i == plan.stops.length - 1,
          ),
        const SizedBox(height: KSpace.md),
        _BudgetCard(plan: plan),
        if (plan.tips.isNotEmpty) ...[
          const SectionTitle('Tips'),
          for (final tip in plan.tips)
            Padding(
              padding: const EdgeInsets.only(bottom: KSpace.sm),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('•  '),
                  Expanded(child: Text(tip)),
                ],
              ),
            ),
        ],
        const SizedBox(height: KSpace.lg),
        FilledButton.icon(
          onPressed: () => showCreateGroupSheet(context, planId: plan.id,
              suggestedName: plan.title),
          icon: const Icon(Icons.group_add_outlined),
          label: const Text('Invite friends'),
        ),
        const SizedBox(height: KSpace.sm),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () async {
                  try {
                    await ref
                        .read(plansRepositoryProvider)
                        .setSaved(uid, plan.id, !plan.saved);
                  } catch (e) {
                    if (context.mounted) showError(context, e);
                  }
                },
                icon: Icon(plan.saved ? Icons.bookmark : Icons.bookmark_outline),
                label: Text(plan.saved ? 'Saved' : 'Save'),
              ),
            ),
            const SizedBox(width: KSpace.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _regenerate(context, ref),
                icon: const Icon(Icons.refresh),
                label: const Text('Another one'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(KSpace.md),
      decoration: BoxDecoration(
        color: KColors.accentSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: KColors.accent),
          const SizedBox(width: KSpace.sm),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

class _StopTile extends StatelessWidget {
  const _StopTile({
    required this.stop,
    required this.index,
    required this.isFirst,
    required this.isLast,
  });

  final PlanStop stop;
  final int index;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final meta = [
      if (stop.startTime != null) stop.startTime!,
      if (stop.durationMinutes != null) _duration(stop.durationMinutes!),
      if (stop.area != null) stop.area!,
      if (stop.cuisine != null) stop.cuisine!,
    ].join(' · ');

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Timeline rail
          SizedBox(
            width: 36,
            child: Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                      color: KColors.accent, shape: BoxShape.circle),
                  child: Text('${index + 1}',
                      style: const TextStyle(
                          color: Colors.white, fontWeight: FontWeight.w700)),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(width: 2, color: KColors.line),
                  ),
              ],
            ),
          ),
          const SizedBox(width: KSpace.sm),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: KSpace.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (stop.kmFromPrevious != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: KSpace.xs),
                      child: Text(
                        '↓ ${stop.kmFromPrevious!.toStringAsFixed(1)} km from the last stop (straight line)',
                        style: text.bodySmall,
                      ),
                    ),
                  Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => context.push('/place/${stop.placeId}'),
                      child: Padding(
                        padding: const EdgeInsets.all(KSpace.md),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                PlaceImage(
                                  url: null,
                                  emoji: Categories.emoji(stop.category),
                                  width: 56,
                                  height: 56,
                                ),
                                const SizedBox(width: KSpace.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(stop.name, style: text.titleMedium),
                                      const SizedBox(height: 2),
                                      Text(
                                        meta.isEmpty
                                            ? Categories.label(stop.category)
                                            : meta,
                                        style: text.bodySmall,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                            if (stop.why != null && stop.why!.isNotEmpty) ...[
                              const SizedBox(height: KSpace.sm),
                              Text(stop.why!, style: text.bodyMedium),
                            ],
                            if (isFirst && stop.hasLocation) ...[
                              const SizedBox(height: KSpace.md),
                              _RideRow(stop: stop),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _duration(int minutes) {
    if (minutes < 60) return '$minutes min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return m == 0 ? '${h}h' : '${h}h ${m}m';
  }
}

/// Ride shortcuts, shown only on the first stop and only when we have its
/// real coordinates — never a guessed location.
class _RideRow extends StatelessWidget {
  const _RideRow({required this.stop});

  final PlanStop stop;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: KSpace.sm,
      runSpacing: KSpace.sm,
      children: [
        ActionChip(
          avatar: const Icon(Icons.local_taxi_outlined, size: 18),
          label: const Text('Uber'),
          onPressed: () =>
              openUber(name: stop.name, lat: stop.lat!, lng: stop.lng!),
        ),
        ActionChip(
          label: const Text('DiDi'),
          onPressed: () => openRideApp('didi'),
        ),
        ActionChip(
          label: const Text('inDrive'),
          onPressed: () => openRideApp('indrive'),
        ),
        ActionChip(
          avatar: const Icon(Icons.map_outlined, size: 18),
          label: const Text('Map'),
          onPressed: () =>
              openInMaps(name: stop.name, lat: stop.lat, lng: stop.lng),
        ),
      ],
    );
  }
}

class _BudgetCard extends StatelessWidget {
  const _BudgetCard({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final budget = plan.request.budgetPerPerson;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Budget', style: text.bodySmall),
            const SizedBox(height: KSpace.xs),
            Text(budget == null ? 'No budget set' : '$budget EGP per person',
                style: text.titleLarge),
            const SizedBox(height: KSpace.xs),
            Text(
              "We don't show prices we haven't confirmed. Check menus or ask "
              'when you arrive.',
              style: text.bodyMedium?.copyWith(color: KColors.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}
