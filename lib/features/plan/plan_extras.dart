import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart';
import '../../widgets/common.dart';

/// "When should I leave?": a rough leave-by time from where you are now to
/// the first stop (straight line × 1.4 at city speed; labeled as rough).
class LeaveByCard extends ConsumerStatefulWidget {
  const LeaveByCard({super.key, required this.plan});

  final OutingPlan plan;

  @override
  ConsumerState<LeaveByCard> createState() => _LeaveByCardState();
}

class _LeaveByCardState extends ConsumerState<LeaveByCard> {
  bool _busy = false;

  Future<void> _locate() async {
    setState(() => _busy = true);
    try {
      final here = await ref.read(locationServiceProvider).current();
      ref.read(myLocationProvider.notifier).set(here);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final first = widget.plan.stops.firstOrNull;
    if (first == null || !first.hasLocation || first.startTime == null) return const SizedBox.shrink();
    // Only for outings today or later.
    final now = DateTime.now();
    if (widget.plan.request.day.isBefore(DateTime(now.year, now.month, now.day))) return const SizedBox.shrink();
    final here = ref.watch(myLocationProvider);
    final km = here == null ? null : haversineKm(here.$1, here.$2, first.lat!, first.lng!);
    final leave = km == null ? null : leaveBy(first.startTime, km);
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: ListTile(
        leading: const Text('🚗', style: TextStyle(fontSize: 24)),
        title: Text(leave == null ? tr('When should I leave?') : trf('Leave around {time}', {'time': leave.time})),
        subtitle: Text(
          leave == null
              ? tr('Uses where you are now, once.')
              : trf('About {n} min to {place} by car. A rough guess: check live traffic.', {
                  'n': leave.minutes,
                  'place': first.name,
                }),
        ),
        trailing: leave == null
            ? (_busy
                  ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                  : TextButton(onPressed: _locate, child: Text(tr('Work it out'))))
            : null,
      ),
    );
  }
}

/// Plan B for rain or heat: real indoor places near each outdoor stop, with
/// a swap button.
Future<void> showIndoorBackups(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final all = await ref.read(allPlacesProvider.future);
  if (!context.mounted) return;
  final byId = {for (final p in all) p.id: p};
  final outdoor = outdoorStops(plan, byId);
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (sheet) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(tr('☔ Indoor backup'), style: Theme.of(sheet).textTheme.titleLarge),
          const SizedBox(height: KSpace.xs),
          Text(tr('If it rains or is too hot, swap an outdoor stop for a real indoor place nearby.')),
          if (outdoor.isEmpty)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.md),
              child: Text(tr('Good news: every stop in this plan is already indoors.')),
            ),
          for (final i in outdoor) ...[
            SectionTitle('${Categories.emoji(plan.stops[i].category)} ${plan.stops[i].name}'),
            if (indoorBackups(plan, i, all) case final options when options.isNotEmpty)
              for (final p in options)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 22)),
                  title: Text(p.shownName),
                  subtitle: Text(
                    [
                      p.kindLabel ?? Categories.label(p.category),
                      trf('{n} km away', {
                        'n': haversineKm(plan.stops[i].lat!, plan.stops[i].lng!, p.lat!, p.lng!).toStringAsFixed(1),
                      }),
                    ].join(' · '),
                  ),
                  trailing: TextButton(
                    onPressed: () async {
                      final uid = ref.read(uidProvider);
                      if (uid == null) return;
                      try {
                        await ref.read(plansRepositoryProvider).replaceStop(uid, plan, i, p);
                        if (sheet.mounted) Navigator.pop(sheet);
                        if (context.mounted) showMessage(context, trf('Swapped in {place}', {'place': p.shownName}));
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: Text(tr('Swap')),
                  ),
                )
            else
              Text(tr('No indoor places on the map within 2 km.')),
          ],
        ],
      ),
    ),
  );
}

/// The plan as a message for someone you trust: where you'll be and until
/// when. Sent only by you, through the app you pick.
String safetyShareText(OutingPlan plan, String planText) {
  final end = planEndTime(plan.stops);
  return [
    tr('🛟 Sharing my outing so you know where I\'ll be.'),
    planText,
    if (end != null) trf('I should be done around {time}.', {'time': end}),
  ].where((s) => s.isNotEmpty).join('\n');
}
