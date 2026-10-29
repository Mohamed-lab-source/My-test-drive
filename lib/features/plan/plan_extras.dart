import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/extras.dart' show cityCenters;
import '../../app/fun.dart' show weatherWarnings;
import '../../data/live_data.dart' show bestHour;
import '../../widgets/launchers.dart' show openDirections;

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

/// "Best time to be outside today": the most comfortable hour left today in
/// your city (one Open-Meteo request, shared with plans).
class BestTimeCard extends ConsumerWidget {
  const BestTimeCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final center = cityCenters[city];
    if (center == null) return const SizedBox.shrink();
    final now = DateTime.now();
    final ymd = DateFormat('yyyy-MM-dd').format(now);
    final hours = ref.watch(hourlyWeatherProvider((center.$1, center.$2, ymd))).value;
    if (hours == null || now.hour >= 22) return const SizedBox.shrink();
    final best = bestHour(hours, from: (now.hour + 1).clamp(9, 23), to: 23);
    if (best == null) return const SizedBox.shrink();
    final (h, w) = best;
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: ListTile(
        leading: const Text('🌤️', style: TextStyle(fontSize: 26)),
        title: Text(trf('Best time to be outside today: {time}', {'time': '${h.toString().padLeft(2, '0')}:00'})),
        subtitle: Text(trf('{t}° · {r}% rain · Open-Meteo forecast', {'t': w.temp.round(), 'r': w.rain})),
      ),
    );
  }
}

/// Heads-up for your coming outings when rain or strong heat is forecast.
class WeatherHeadsUp extends ConsumerWidget {
  const WeatherHeadsUp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final week = ref.watch(weekForecastProvider(city)).value;
    if (week == null || week.isEmpty) return const SizedBox.shrink();
    final plans = ref.watch(recentPlansProvider).value ?? const <OutingPlan>[];
    final groups = ref.watch(myGroupsProvider).value ?? const [];
    final outings = [
      for (final p in plans)
        if (p.request.date != null && p.request.city == city) (p.title, p.request.day),
      for (final g in groups)
        if (g.scheduledAt != null) (g.planTitle ?? g.name, g.scheduledAt!),
    ];
    final warnings = weatherWarnings(outings, week, DateTime.now());
    if (warnings.isEmpty) return const SizedBox.shrink();
    final (title, day, f) = warnings.first;
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      child: ListTile(
        leading: Text(f.rainPct >= 50 ? '☔' : '🥵', style: const TextStyle(fontSize: 26)),
        title: Text(
          f.rainPct >= 50
              ? trf('Rain likely for "{plan}"', {'plan': title})
              : trf('Very hot for "{plan}"', {'plan': title}),
        ),
        subtitle: Text(
          trf('{day}: {t}° · {r}% rain. Open the plan for indoor backup ideas.', {
            'day': DateFormat('EEE d MMM').format(day),
            't': f.maxC.round(),
            'r': f.rainPct,
          }),
        ),
        onTap: () => context.go('/plans'),
      ),
    );
  }
}

/// On the day of the outing: where you should be now and what's next.
class NowBanner extends StatelessWidget {
  const NowBanner({super.key, required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final day = plan.request.day;
    if (day.year != now.year || day.month != now.month || day.day != now.day) return const SizedBox.shrink();
    final (now: at, :next) = currentAndNext(plan.stops, now);
    if (at == null && next == null) return const SizedBox.shrink();
    final target = next == null ? null : plan.stops[next];
    return Card(
      margin: const EdgeInsets.only(top: KSpace.md),
      color: context.k.accentSoft,
      child: ListTile(
        leading: const Text('📍', style: TextStyle(fontSize: 26)),
        title: Text(
          at != null
              ? trf('Now: {place}', {'place': plan.stops[at].name})
              : trf('Next: {place} at {time}', {'place': target!.name, 'time': target.startTime ?? ''}),
        ),
        subtitle: at != null && target != null
            ? Text(trf('Then {place} at {time}', {'place': target.name, 'time': target.startTime ?? ''}))
            : null,
        trailing: target != null && target.hasLocation
            ? IconButton(
                tooltip: tr('Directions'),
                icon: const Icon(Icons.directions),
                onPressed: () => openDirections(lat: target.lat!, lng: target.lng!),
              )
            : null,
      ),
    );
  }
}
