import 'reminder_sheet.dart' show ReminderButton;
import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/extras.dart';
import '../../app/helpers.dart' show sameDay, totalStopMinutes, showTime, walkingMinutes, weatherIcon;
import '../../app/local_prefs.dart';
import '../../app/review.dart';
import '../../app/share_texts.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart';
import '../../data/live_data.dart' show weatherAt;
import '../../planner/services.dart' show AiUnavailable;
import '../../widgets/common.dart';
import '../../widgets/motion.dart';
import '../../widgets/khroga_map.dart';
import '../../widgets/share_card.dart';
import '../../widgets/launchers.dart';
import '../groups/create_group_sheet.dart';
import 'plan_extras.dart';
import 'plan_form_screen.dart';

class PlanResultScreen extends ConsumerWidget {
  const PlanResultScreen({super.key, required this.planId});

  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plan = ref.watch(planProvider(planId));
    final loaded = plan.value;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Your plan')),
        actions: [
          if (loaded != null)
            ReminderButton(
              reminderKey: 'plan:${loaded.id}',
              title: loaded.title,
              route: '/plan/${loaded.id}',
              day: loaded.request.date == null ? null : loaded.request.day,
              start: loaded.stops.firstOrNull?.startTime,
              firstStop: loaded.stops.firstOrNull?.name,
            ),
          if (loaded != null)
            PopupMenuButton<String>(
              tooltip: tr('Share plan'),
              icon: const Icon(Icons.share_outlined),
              onSelected: (v) => v == 'picture'
                  ? sharePictureCard(context, planStoryCard(loaded), planShareText(loaded))
                  : SharePlus.instance.share(ShareParams(text: planShareText(loaded))),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'picture', child: Text(tr('Share as a picture'))),
                PopupMenuItem(value: 'text', child: Text(tr('Share as text'))),
              ],
            ),
          if (loaded != null)
            PopupMenuButton<String>(
              onSelected: (v) => _menu(context, ref, loaded, v),
              itemBuilder: (_) => [
                PopupMenuItem(value: 'mystery', child: Text(tr('🎁 Mystery mode: reveal stop by stop'))),
                PopupMenuItem(value: 'mysterySend', child: Text(tr('🎁 Send as a surprise to a friend'))),
                PopupMenuItem(value: 'backup', child: Text(tr('☔ Indoor backup ideas'))),
                PopupMenuItem(value: 'safety', child: Text(tr('🛟 Share with someone I trust'))),
                PopupMenuItem(value: 'copy', child: Text(tr('Copy plan as text'))),
                PopupMenuItem(value: 'calendar', child: Text(tr('Add to Google Calendar'))),
                PopupMenuItem(value: 'duplicate', child: Text(tr('Make a copy'))),
                PopupMenuItem(value: 'group', child: Text(tr('Send to a group chat'))),
                const PopupMenuDivider(),
                PopupMenuItem(value: 'now', child: Text(tr('Start now'))),
                PopupMenuItem(value: 'later', child: Text(tr('Everything 30 min later'))),
                PopupMenuItem(value: 'earlier', child: Text(tr('Everything 30 min earlier'))),
              ],
            ),
        ],
      ),
      body: AsyncView<OutingPlan?>(
        value: plan,
        onRetry: () => ref.invalidate(planProvider(planId)),
        builder: (p) => p == null
            ? EmptyState(emoji: '🗺️', title: tr('This plan was deleted'))
            : _PlanBody(plan: p),
      ),
    );
  }
}

Future<void> _menu(BuildContext context, WidgetRef ref, OutingPlan plan, String action) async {
  switch (action) {
    case 'mystery':
      context.push('/mystery/${plan.id}');
    case 'mysterySend':
      await SharePlus.instance.share(ShareParams(text: mysteryPlanText(plan)));
    case 'backup':
      await showIndoorBackups(context, ref, plan);
    case 'safety':
      await SharePlus.instance.share(ShareParams(text: safetyShareText(plan, planShareText(plan))));
    case 'copy':
      await Clipboard.setData(ClipboardData(text: planShareText(plan)));
      if (context.mounted) showMessage(context, tr('Plan copied. Paste it anywhere.'));
    case 'calendar':
      await openUri(planCalendarLink(plan));
    case 'now':
      final n = DateTime.now();
      final m = ((n.hour * 60 + n.minute + 14) ~/ 15) * 15; // next quarter hour
      final hhmm = '${(m ~/ 60 % 24).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
      await _editStops(context, ref, plan, retime(setStopTime(plan.stops, 0, hhmm)));
    case 'later':
      await _editStops(context, ref, plan, shiftTimes(plan.stops, 30));
    case 'earlier':
      await _editStops(context, ref, plan, shiftTimes(plan.stops, -30));
    case 'group':
      final uid = ref.read(uidProvider);
      final groups = await ref.read(myGroupsProvider.future);
      if (uid == null || !context.mounted) return;
      if (groups.isEmpty) {
        showMessage(context, tr("You're not in any group yet."));
        return;
      }
      final picked = await showModalBottomSheet<String>(
        context: context,
        useSafeArea: true,
        builder: (sheetContext) => ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(KSpace.md),
          children: [
            Text(tr('Send to which group?'), style: Theme.of(sheetContext).textTheme.titleLarge),
            for (final g in groups)
              ListTile(
                leading: const Icon(Icons.forum_outlined),
                title: Text(g.name),
                onTap: () => Navigator.pop(sheetContext, g.id),
              ),
          ],
        ),
      );
      if (picked == null) return;
      final text = planShareText(plan);
      try {
        await ref.read(groupsRepositoryProvider).sendMessage(
              groupId: picked,
              uid: uid,
              name: ref.read(myProfileProvider).value?.displayName ?? 'Someone',
              text: text.length > 1000 ? text.substring(0, 1000) : text,
            );
        if (context.mounted) showMessage(context, tr('Sent to the group'));
      } catch (e) {
        if (context.mounted) showError(context, e);
      }
    case 'duplicate':
      final uid = ref.read(uidProvider);
      if (uid == null) return;
      try {
        final id = await ref.read(plansRepositoryProvider).duplicate(uid, plan);
        if (context.mounted) {
          showMessage(context, tr('Copy made'));
          context.push('/plan/$id');
        }
      } catch (e) {
        if (context.mounted) showError(context, e);
      }
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
    final done = ref.watch(planChecklistProvider);
    final endsAt = planEndTime(plan.stops);
    final clock24 = ref.watch(phoneSettingsProvider.select((s) => s.clock24));
    final legs = plan.stops.map((s) => s.kmFromPrevious).whereType<double>().toList();
    final walkable = legs.isNotEmpty && legs.every((km) => km <= 1.0);
    return ListView(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: () => _rename(context, ref, plan),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: FadeSlideIn(child: Text(plan.title, style: text.headlineLarge))),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Icon(Icons.edit_outlined, size: 20, color: context.k.inkMuted),
              ),
            ],
          ),
        ),
        const SizedBox(height: KSpace.sm),
        if (plan.summary.isNotEmpty)
          Text(plan.summary,
              style: text.bodyLarge?.copyWith(color: context.k.inkMuted)),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            Pill(plan.request.groupSize == 1
                ? tr('1 person')
                : trf('{n} people', {'n': plan.request.groupSize})),
            Pill(tr(Cities.all[plan.request.city] ?? plan.request.city)),
            Pill(tr(TimesOfDay.all[plan.request.timeOfDay] ?? plan.request.timeOfDay)),
            if (plan.request.date != null) Pill(DateFormat('EEE d MMM').format(plan.request.day)),
            if (plan.isMallLocked) Pill(tr('🛍️ One mall')),
            if (plan.request.hasAnchor) Pill(trf('📍 Around {place}', {'place': plan.request.nearLabel == 'you' ? tr('you') : plan.request.nearLabel ?? tr('a spot')})),
            if (_daysAway(plan.request.day) case final d? when d > 0)
              Pill(d == 1 ? tr('⏳ Tomorrow') : trf('⏳ In {n} days', {'n': d})),
            if (endsAt != null && plan.stops.first.startTime != null)
              Pill('🕘 ${showTime(plan.stops.first.startTime, clock24: clock24)}–${showTime(endsAt, clock24: clock24)}'),
            if (walkable) Pill(tr('🚶 Walkable route')),
            if (totalStopMinutes(plan.stops.map((s) => s.durationMinutes)) > 0)
              Pill(trf('⏱ {t} at stops', {'t': _StopTile._duration(totalStopMinutes(plan.stops.map((s) => s.durationMinutes)))})),
          ],
        ),
        if (plan.stops.isNotEmpty && plan.stops.first.hasLocation) ...[
          const SizedBox(height: KSpace.md),
          GradientButton(
            onPressed: () =>
                openDirections(lat: plan.stops.first.lat!, lng: plan.stops.first.lng!),
            icon: Icons.navigation_outlined,
            label: trf('Go to the first stop: {name}', {'name': plan.stops.first.name}),
          ),
        ],
        if (plan.stops.length < plan.request.stops) ...[
          const SizedBox(height: KSpace.md),
          _InfoBanner(
            icon: Icons.lightbulb_outline,
            text: trf(
                'We found {n} of the {want} stops you asked for that fit everything. For more, try a bigger '
                'distance, fewer must-haves, or turn off "Only places open at that time".',
                {'n': plan.stops.length, 'want': plan.request.stops}),
          ),
        ],
        if (plan.weatherNote != null) ...[
          const SizedBox(height: KSpace.md),
          _InfoBanner(icon: weatherIcon(plan.weatherNote!), text: plan.weatherNote!),
        ],
        if (_dayFacts(plan) case final facts?) ...[
          const SizedBox(height: KSpace.md),
          _InfoBanner(icon: Icons.wb_twilight, text: facts),
        ],
        NowBanner(plan: plan),
        LeaveByCard(plan: plan),
        if (plan.source == 'fallback') ...[
          const SizedBox(height: KSpace.md),
          _InfoBanner(
            icon: Icons.info_outline,
            text: tr('The AI was busy or offline, so our planner picked real places for you.'),
          ),
        ],
        if (plan.source != 'ai') ...[
          const SizedBox(height: KSpace.md),
          _MakeNicer(plan: plan),
        ],
        if (plan.source == 'ai')
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: TextButton.icon(
              icon: const Icon(Icons.flag_outlined, size: 18),
              label: Text(tr('Report the AI-written text')),
              onPressed: () => _reportAi(context, ref, plan),
            ),
          ),
        const SizedBox(height: KSpace.lg),
        for (var i = 0; i < plan.stops.length; i++)
          FadeSlideIn(index: i, child: _StopTile(
            stop: plan.stops[i],
            day: plan.request.day,
            clock24: clock24,
            index: i,
            isFirst: i == 0,
            isLast: i == plan.stops.length - 1,
            done: done.contains(PlanChecklist.keyFor(plan.id, plan.stops[i].placeId)),
            onToggleDone: () =>
                ref.read(planChecklistProvider.notifier).toggle(plan.id, plan.stops[i].placeId),
            legUrl: i == 0 ? null : legMapsUrl(plan.stops[i - 1], plan.stops[i]),
            onSwap: () => _showSwapSheet(context, ref, plan, i),
            onUp: i == 0 ? null : () => _editStops(context, ref, plan, moveStop(plan.stops, i, i - 1)),
            onDown: i == plan.stops.length - 1
                ? null
                : () => _editStops(context, ref, plan, moveStop(plan.stops, i, i + 1)),
            onRemove: plan.stops.length <= 1
                ? null
                : () => _editStops(context, ref, plan, removeStop(plan.stops, i)),
            onEditTime: () => _editTime(context, ref, plan, i),
            onEditLength: () => _editLength(context, ref, plan, i),
            onEditNote: () => _editNote(context, ref, plan, i),
          )),
        if (plan.stops.where((s) => s.hasLocation).length >= 2) ...[
          ClipRRect(
            borderRadius: BorderRadius.circular(KRadius.card),
            child: SizedBox(
              height: 220,
              child: GestureDetector(
                onDoubleTap: () => _showBigMap(context, plan),
                child: KhrogaMap(
                route: true,
                pins: [
                  for (final (i, s) in plan.stops.indexed)
                    if (s.hasLocation)
                      MapPin(
                        lat: s.lat!,
                        lng: s.lng!,
                        label: s.name,
                        number: i + 1,
                        onTap: () => context.push('/place/${s.placeId}'),
                      ),
                ],
              ),
              ),
            ),
          ),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: TextButton.icon(
              onPressed: () => _showBigMap(context, plan),
              icon: const Icon(Icons.fullscreen),
              label: Text(tr('Bigger map')),
            ),
          ),
          const SizedBox(height: KSpace.sm),
        ],
        _RouteCard(plan: plan),
        if (plan.stops.where((s) => s.hasLocation).length >= 3)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () async {
                await _editStops(context, ref, plan, shortestRoute(plan.stops));
                if (context.mounted) showMessage(context, tr('Stops reordered for a shorter route'));
              },
              icon: const Icon(Icons.alt_route),
              label: Text(tr('Shortest route')),
            ),
          ),
        if (plan.stops.length < 5)
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _showAddStopSheet(context, ref, plan),
              icon: const Icon(Icons.add_location_alt_outlined),
              label: Text(tr('Add a stop')),
            ),
          ),
        const SizedBox(height: KSpace.md),
        _BudgetCard(plan: plan),
        const SizedBox(height: KSpace.sm),
        _BringList(planId: plan.id),
        const SizedBox(height: KSpace.sm),
        _HowWasIt(planId: plan.id),
        if (plan.tips.isNotEmpty) ...[
          SectionTitle(tr('Tips')),
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
          label: Text(tr('Invite friends')),
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
                    if (!plan.saved) happyMoment(ref);
                  } catch (e) {
                    if (context.mounted) showError(context, e);
                  }
                },
                icon: Icon(plan.saved ? Icons.bookmark : Icons.bookmark_outline),
                label: Text(plan.saved ? tr('Saved') : tr('Save')),
              ),
            ),
            const SizedBox(width: KSpace.sm),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _regenerate(context, ref),
                icon: const Icon(Icons.refresh),
                label: Text(tr('Another one')),
              ),
            ),
          ],
        ),
        const SizedBox(height: KSpace.sm),
        FilledButton.tonalIcon(
          onPressed: () => sharePictureCard(context, planStoryCard(plan), planShareText(plan)),
          icon: const Icon(Icons.photo_camera_back_outlined),
          label: Text(tr('Send to friends as a picture')),
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
        color: context.k.accentSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: context.k.accent),
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
    required this.onSwap,
    required this.done,
    required this.onToggleDone,
    this.legUrl,
    this.onUp,
    this.onDown,
    this.onRemove,
    required this.onEditTime,
    required this.onEditLength,
    required this.onEditNote,
    required this.day,
    required this.clock24,
  });

  /// The outing day (for checking opening hours) and the clock style.
  final DateTime day;
  final bool clock24;
  final VoidCallback onEditTime;
  final VoidCallback onEditLength;
  final VoidCallback onEditNote;

  final VoidCallback onSwap;
  final bool done;
  final VoidCallback onToggleDone;

  /// Directions from the previous stop, when both have coordinates.
  final Uri? legUrl;
  final VoidCallback? onUp;
  final VoidCallback? onDown;
  final VoidCallback? onRemove;

  final PlanStop stop;
  final int index;
  final bool isFirst;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final end = stopEndTime(stop);
    final start = showTime(stop.startTime, clock24: clock24);
    final meta = [
      if (stop.startTime != null) end == null ? start : '$start–${showTime(end, clock24: clock24)}',
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
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    gradient: context.k.accentGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(color: context.k.accent.withValues(alpha: 0.4), blurRadius: 10, offset: const Offset(0, 3)),
                    ],
                  ),
                  child: done
                      ? Icon(Icons.check, size: 18, color: context.k.onAccent)
                      : Text('${index + 1}',
                          style: TextStyle(
                              color: context.k.onAccent, fontWeight: FontWeight.w700)),
                ),
                if (!isLast)
                  Expanded(
                    child: Container(
                      width: 2.5,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(2),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [context.k.accent.withValues(alpha: 0.7), context.k.line],
                        ),
                      ),
                    ),
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
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              trf('↓ {km} km from the last stop (straight line)',
                                      {'km': stop.kmFromPrevious!.toStringAsFixed(1)}) +
                                  (stop.kmFromPrevious! <= 1.5
                                      ? trf(' · about {n} min walk', {'n': walkingMinutes(stop.kmFromPrevious!)})
                                      : ''),
                              style: text.bodySmall,
                            ),
                          ),
                          if (legUrl != null)
                            TextButton.icon(
                              style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(horizontal: KSpace.sm)),
                              onPressed: () => openUri(legUrl!),
                              icon: const Icon(Icons.directions, size: 16),
                              label: Text(tr('Directions')),
                            ),
                        ],
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
                                _StopPhoto(stop: stop),
                                const SizedBox(width: KSpace.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(stop.name,
                                          style: text.titleMedium?.copyWith(
                                              decoration: done ? TextDecoration.lineThrough : null)),
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
                                IconButton(
                                  tooltip: done ? tr('Not done yet') : tr('Mark as done'),
                                  onPressed: onToggleDone,
                                  icon: Icon(done ? Icons.check_circle : Icons.check_circle_outline,
                                      color: done ? context.k.accent : context.k.inkMuted),
                                ),
                              ],
                            ),
                            _OpenThen(stop: stop, day: day),
                            _StopWeather(stop: stop, day: day),
                            if (stop.why != null && stop.why!.isNotEmpty) ...[
                              const SizedBox(height: KSpace.sm),
                              Text(stop.why!, style: text.bodyMedium),
                            ],
                            if (stop.note != null) ...[
                              const SizedBox(height: KSpace.sm),
                              Text('📝 ${stop.note}', style: text.bodyMedium),
                            ],
                            if (isFirst && stop.hasLocation) ...[
                              const SizedBox(height: KSpace.md),
                              _RideRow(stop: stop),
                            ],
                            Row(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                IconButton(
                                  tooltip: tr('Move up'),
                                  onPressed: onUp,
                                  icon: const Icon(Icons.arrow_upward, size: 20),
                                ),
                                IconButton(
                                  tooltip: tr('Move down'),
                                  onPressed: onDown,
                                  icon: const Icon(Icons.arrow_downward, size: 20),
                                ),
                                PopupMenuButton<String>(
                                  tooltip: tr('Edit this stop'),
                                  icon: const Icon(Icons.more_horiz, size: 20),
                                  onSelected: (v) => switch (v) {
                                    'time' => onEditTime(),
                                    'length' => onEditLength(),
                                    'note' => onEditNote(),
                                    _ => onRemove?.call(),
                                  },
                                  itemBuilder: (_) => [
                                    PopupMenuItem(value: 'time', child: Text(tr('Change start time'))),
                                    PopupMenuItem(value: 'length', child: Text(tr('Change how long'))),
                                    PopupMenuItem(
                                        value: 'note',
                                        child: Text(stop.note == null ? tr('Add a note') : tr('Edit note'))),
                                    PopupMenuItem(
                                        value: 'remove',
                                        enabled: onRemove != null,
                                        child: Text(tr('Remove stop'))),
                                  ],
                                ),
                                TextButton.icon(
                                  onPressed: onSwap,
                                  icon: const Icon(Icons.swap_horiz, size: 18),
                                  label: Text(tr('Swap')),
                                ),
                              ],
                            ),
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
          label: Text(tr('Uber')),
          onPressed: () =>
              openUber(name: stop.name, lat: stop.lat!, lng: stop.lng!),
        ),
        ActionChip(
          label: Text(tr('DiDi')),
          onPressed: () => openRideApp('didi'),
        ),
        ActionChip(
          label: Text(tr('inDrive')),
          onPressed: () => openRideApp('indrive'),
        ),
        ActionChip(
          avatar: const Icon(Icons.map_outlined, size: 18),
          label: Text(tr('Map')),
          onPressed: () =>
              openInMaps(name: stop.name, lat: stop.lat, lng: stop.lng),
        ),
        ActionChip(
          avatar: const Icon(Icons.navigation_outlined, size: 18),
          label: Text(tr('Waze')),
          onPressed: () => openUri(Uri.https('waze.com', '/ul', {'ll': '${stop.lat},${stop.lng}', 'navigate': 'yes'})),
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
            Text(tr('Budget'), style: text.bodySmall),
            const SizedBox(height: KSpace.xs),
            Text(budget == null ? tr('No budget set') : trf('{n} EGP per person', {'n': budget}),
                style: text.titleLarge),
            const SizedBox(height: KSpace.xs),
            Text(
              tr("We don't show prices we haven't confirmed. Check menus or ask "
              'when you arrive.'),
              style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
            ),
          ],
        ),
      ),
    );
  }
}

/// Plain text for sharing a plan (e.g. on WhatsApp), with map links.
String planShareText(OutingPlan plan) {
  final lines = <String>['🗺️ ${plan.title}'];
  if (plan.summary.isNotEmpty) lines.add(plan.summary);
  if (plan.request.date != null) lines.add('📅 ${DateFormat('EEEE d MMM').format(plan.request.day)}');
  if (plan.weatherNote != null) lines.add('🌤️ ${plan.weatherNote}');
  lines.add('');
  for (var i = 0; i < plan.stops.length; i++) {
    final s = plan.stops[i];
    final where = s.area == null ? '' : ' (${s.area})';
    final time = s.startTime == null ? '' : '${s.startTime} ';
    lines.add('${i + 1}. $time${Categories.emoji(s.category)} ${s.name}$where');
    if (s.hasLocation) {
      lines.add('   ${Uri.https('www.google.com', '/maps/search/', {
        'api': '1',
        'query': '${s.lat},${s.lng}',
      })}');
    }
  }
  if (routeMapsUrl(plan.stops) case final url?) {
    lines
      ..add('')
      ..add('${tr('🗺️ Our route')}: $url');
  }
  lines
    ..add('')
    ..add(tr('Planned with Khroga') + planLinkLine(plan));
  return lines.join('\n');
}

/// Lets the person replace one stop with a similar real place nearby.
Future<void> _showSwapSheet(BuildContext context, WidgetRef ref, OutingPlan plan, int index) async {
  final repo = ref.read(plansRepositoryProvider);
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final messenger = ScaffoldMessenger.of(context);
  final options = await repo.alternatives(plan, index);
  if (!context.mounted) return;
  if (options.isEmpty) {
    showMessage(context, tr('No similar places nearby to swap in.'));
    return;
  }
  final picked = await showModalBottomSheet<Place>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.65,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(trf('Swap "{place}"', {'place': plan.stops[index].name}),
              style: Theme.of(sheetContext).textTheme.titleLarge),
          const SizedBox(height: KSpace.xs),
          Text(tr('Similar real places nearby'), style: Theme.of(sheetContext).textTheme.bodySmall),
          const SizedBox(height: KSpace.md),
          for (final p in options)
            Card(
              margin: const EdgeInsets.only(bottom: KSpace.sm),
              child: ListTile(
                leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 24)),
                title: Text(p.name),
                subtitle: Text([
                  p.kindLabel ?? Categories.label(p.category),
                  if (p.area != null) p.area!,
                  if (p.cuisineLabel != null) p.cuisineLabel!,
                  if (index > 0 && plan.stops[index - 1].hasLocation && p.hasLocation)
                    trf('{km} km from the last stop', {
                      'km': haversineKm(plan.stops[index - 1].lat!, plan.stops[index - 1].lng!, p.lat!, p.lng!)
                          .toStringAsFixed(1)
                    }),
                  if (p.isOpenAt(DateTime.now()) == true) tr('Open now'),
                ].join(' · ')),
                onTap: () => Navigator.pop(sheetContext, p),
              ),
            ),
        ],
      ),
    ),
  );
  if (picked == null) return;
  try {
    await repo.replaceStop(uid, plan, index, picked);
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
  }
}

/// Saves an edited list of stops (reordered, removed or added).
Future<void> _editStops(
    BuildContext context, WidgetRef ref, OutingPlan plan, List<PlanStop> stops,
    {bool undoable = true}) async {
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final repo = ref.read(plansRepositoryProvider);
  final before = plan.stops;
  final messenger = ScaffoldMessenger.of(context);
  try {
    await repo.updateStops(uid, plan.id, stops);
    if (undoable) {
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
          content: Text(tr('Plan updated')),
          action: SnackBarAction(label: tr('Undo'), onPressed: () => repo.updateStops(uid, plan.id, before)),
        ));
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

Future<void> _rename(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final controller = TextEditingController(text: plan.title);
  final title = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('Rename plan')),
      content: TextField(controller: controller, autofocus: true, maxLength: 80),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(tr('Save'))),
      ],
    ),
  );
  controller.dispose();
  final uid = ref.read(uidProvider);
  if (title == null || title.trim().isEmpty || uid == null) return;
  try {
    await ref.read(plansRepositoryProvider).rename(uid, plan.id, title);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// Lets the person add one more real place, nearest to the last stop first.
Future<void> _showAddStopSheet(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final all = await ref.read(placesRepositoryProvider).all();
  final used = {for (final s in plan.stops) s.placeId};
  final last = plan.stops.isEmpty ? null : plan.stops.last;
  final options = all
      .where((p) => !used.contains(p.id) && p.category != 'shop' && passesFilters(p, plan.request))
      .toList();
  double dist(Place p) => last != null && last.hasLocation && p.hasLocation
      ? haversineKm(last.lat!, last.lng!, p.lat!, p.lng!)
      : 9999;
  options.sort((a, b) {
    final d = dist(a).compareTo(dist(b));
    return d != 0 ? d : b.quality.compareTo(a.quality);
  });
  if (!context.mounted) return;
  final picked = await showModalBottomSheet<Place>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(tr('Add a stop'), style: Theme.of(sheetContext).textTheme.titleLarge),
          const SizedBox(height: KSpace.xs),
          Text(tr('Real places near your last stop'), style: Theme.of(sheetContext).textTheme.bodySmall),
          const SizedBox(height: KSpace.md),
          for (final p in options.take(25))
            Card(
              margin: const EdgeInsets.only(bottom: KSpace.sm),
              child: ListTile(
                leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 24)),
                title: Text(p.name),
                subtitle: Text([
                  p.kindLabel ?? Categories.label(p.category),
                  if (p.area != null) p.area!,
                  if (dist(p) < 9999) '${dist(p).toStringAsFixed(1)} km away',
                ].join(' · ')),
                onTap: () => Navigator.pop(sheetContext, p),
              ),
            ),
        ],
      ),
    ),
  );
  if (picked == null || !context.mounted) return;
  await _editStops(context, ref, plan, addStop(plan.stops, picked));
}

/// Total distance, a rough travel time, and the full route in Google Maps.
class _RouteCard extends StatelessWidget {
  const _RouteCard({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final summary = routeSummary(plan.stops);
    final url = routeMapsUrl(plan.stops);
    if (summary == null && url == null) return const SizedBox.shrink();
    return Card(
      child: ListTile(
        leading: const Text('🧭', style: TextStyle(fontSize: 24)),
        title: Text(summary == null
            ? tr('Your route')
            : '${summary.km} km between stops · about ${summary.minutes} min by car'),
        subtitle: Text(tr('Straight-line distance; the time is a rough estimate. '
            'Tap to open the whole route in Google Maps.')),
        trailing: const Icon(Icons.open_in_new),
        onTap: url == null ? null : () => openUri(url),
      ),
    );
  }
}

int? _daysAway(DateTime day) {
  final now = DateTime.now();
  if (sameDay(day, now)) return 0;
  return DateTime(day.year, day.month, day.day).difference(DateTime(now.year, now.month, now.day)).inDays;
}

Future<void> _editTime(BuildContext context, WidgetRef ref, OutingPlan plan, int i) async {
  final parts = plan.stops[i].startTime?.split(':');
  final initial = parts == null || parts.length != 2
      ? const TimeOfDay(hour: 18, minute: 0)
      : TimeOfDay(hour: int.tryParse(parts[0]) ?? 18, minute: int.tryParse(parts[1]) ?? 0);
  final t = await showTimePicker(context: context, initialTime: initial);
  if (t == null || !context.mounted) return;
  final hhmm = '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  await _editStops(context, ref, plan, setStopTime(plan.stops, i, hhmm));
}

Future<void> _editLength(BuildContext context, WidgetRef ref, OutingPlan plan, int i) async {
  const options = [30, 45, 60, 90, 120, 150, 180, 240];
  final picked = await showDialog<int>(
    context: context,
    builder: (dialogContext) => SimpleDialog(
      title: Text(tr('How long at this stop?')),
      children: [
        for (final m in options)
          SimpleDialogOption(
            onPressed: () => Navigator.pop(dialogContext, m),
            child: Text(m < 60 ? '$m min' : m % 60 == 0 ? '${m ~/ 60} h' : '${m ~/ 60} h ${m % 60} min'),
          ),
      ],
    ),
  );
  if (picked == null || !context.mounted) return;
  await _editStops(context, ref, plan, setStopDuration(plan.stops, i, picked));
}

Future<void> _editNote(BuildContext context, WidgetRef ref, OutingPlan plan, int i) async {
  final controller = TextEditingController(text: plan.stops[i].note ?? '');
  final note = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('Note for this stop')),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 200,
        decoration: InputDecoration(hintText: tr('e.g. Book a table for 6')),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(tr('Save'))),
      ],
    ),
  );
  controller.dispose();
  if (note == null || !context.mounted) return;
  await _editStops(context, ref, plan, setStopNote(plan.stops, i, note));
}

/// "Things to bring" checklist for this plan (saved on the phone).
class _BringList extends ConsumerWidget {
  const _BringList({required this.planId});

  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final raw = ref.watch(bringListsProvider)[planId] ?? '';
    final items = raw.split('\n').where((l) => l.trim().isNotEmpty).toList();
    final notifier = ref.read(bringListsProvider.notifier);
    void save(List<String> list) => notifier.set(planId, list.join('\n'));

    Future<void> add() async {
      final controller = TextEditingController();
      final item = await showDialog<String>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(tr('Add something to bring')),
          content: TextField(
            controller: controller,
            autofocus: true,
            maxLength: 60,
            decoration: InputDecoration(hintText: tr('e.g. Power bank, ID card')),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
            FilledButton(
                onPressed: () => Navigator.pop(dialogContext, controller.text),
                child: Text(tr('Add'))),
          ],
        ),
      );
      controller.dispose();
      if (item != null && item.trim().isNotEmpty) save([...items, item.trim()]);
    }

    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Text('🎒', style: TextStyle(fontSize: 22)),
            title: Text(tr('Things to bring')),
            subtitle: items.isEmpty ? Text(tr('Only on this phone')) : null,
            trailing: IconButton(tooltip: tr('Add'), icon: const Icon(Icons.add), onPressed: add),
          ),
          if (items.length < 6)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
              child: Wrap(
                spacing: KSpace.xs,
                children: [
                  for (final sug in const ['💧 Water', '🔋 Power bank', '💵 Cash', '🪪 ID card', '🧥 Jacket', '🧴 Sunscreen'])
                    if (!items.any((x) => x.replaceFirst('✓ ', '') == tr(sug)))
                      ActionChip(
                        visualDensity: VisualDensity.compact,
                        label: Text(tr(sug)),
                        onPressed: () => save([...items, tr(sug)]),
                      ),
                ],
              ),
            ),
          for (final (i, item) in items.indexed)
            CheckboxListTile(
              dense: true,
              value: item.startsWith('✓ '),
              title: Text(item.replaceFirst('✓ ', '')),
              secondary: IconButton(
                tooltip: tr('Remove'),
                icon: const Icon(Icons.close, size: 18),
                onPressed: () => save([...items]..removeAt(i)),
              ),
              onChanged: (on) => save([...items]
                ..[i] = on == true ? '✓ ${item.replaceFirst('✓ ', '')}' : item.replaceFirst('✓ ', '')),
            ),
        ],
      ),
    );
  }
}

/// A private thumbs up / down after the outing (saved on the phone).
class _HowWasIt extends ConsumerWidget {
  const _HowWasIt({required this.planId});

  final String planId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rating = ref.watch(planRatingsProvider)[planId];
    final n = ref.read(planRatingsProvider.notifier);
    return Card(
      child: ListTile(
        leading: const Text('💬', style: TextStyle(fontSize: 22)),
        title: Text(tr('How was it?')),
        subtitle: Text(rating == null ? tr('Just for you') : rating == 'up' ? tr('You loved it') : tr('Not great')),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: tr('Loved it'),
              onPressed: () {
                n.set(planId, rating == 'up' ? null : 'up');
                if (rating != 'up') happyMoment(ref);
              },
              icon: Icon(rating == 'up' ? Icons.thumb_up : Icons.thumb_up_outlined,
                  color: rating == 'up' ? context.k.accent : null),
            ),
            IconButton(
              tooltip: tr('Not great'),
              onPressed: () => n.set(planId, rating == 'down' ? null : 'down'),
              icon: Icon(rating == 'down' ? Icons.thumb_down : Icons.thumb_down_outlined,
                  color: rating == 'down' ? context.k.accent : null),
            ),
          ],
        ),
      ),
    );
  }
}

/// Optional: let Gemini write a title, summary, tips and a sentence per
/// stop. The places, order and times stay exactly the same.
class _MakeNicer extends ConsumerStatefulWidget {
  const _MakeNicer({required this.plan});

  final OutingPlan plan;

  @override
  ConsumerState<_MakeNicer> createState() => _MakeNicerState();
}

class _MakeNicerState extends ConsumerState<_MakeNicer> {
  bool _busy = false;

  Future<void> _run() async {
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    setState(() => _busy = true);
    try {
      await ref.read(plansRepositoryProvider).improveWithAi(uid, widget.plan);
    } on AiUnavailable catch (e) {
      if (mounted) {
        showMessage(
            context,
            e.resting
                ? tr('AI is resting for now (free daily limit). Your plan is ready as it is.')
                : tr("The AI couldn't help right now. Your plan is ready as it is."));
      }
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        leading: const Text('✨', style: TextStyle(fontSize: 24)),
        title: Text(tr('Made by our planner')),
        subtitle: Text(tr('Want a friendlier title and description? Let the AI write them.')),
        trailing: _busy
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2.5))
            : FilledButton.tonal(onPressed: _run, child: Text(tr('Make it nicer'))),
      ),
    );
  }
}

/// Opening-hours check for a stop on the outing day: open / closed / unknown.
class _OpenThen extends ConsumerWidget {
  const _OpenThen({required this.stop, required this.day});

  final PlanStop stop;
  final DateTime day;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final place = ref.watch(placeProvider(stop.placeId)).value;
    final parts = stop.startTime?.split(':');
    if (place == null || parts == null || parts.length != 2) return const SizedBox.shrink();
    final at = DateTime(day.year, day.month, day.day, int.tryParse(parts[0]) ?? 0, int.tryParse(parts[1]) ?? 0);
    final open = place.isOpenAt(at);
    if (open == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.xs),
      child: Text(
        open ? tr('✅ Open at that time') : tr('⚠️ Closed at that time. Swap it or change the time.'),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: open ? context.k.accent : Theme.of(context).colorScheme.error,
        ),
      ),
    );
  }
}

void _showBigMap(BuildContext context, OutingPlan plan) {
  showDialog<void>(
    context: context,
    builder: (d) => Dialog.fullscreen(
      child: Stack(
        children: [
          KhrogaMap(
            route: true,
            pins: [
              for (final (i, s) in plan.stops.indexed)
                if (s.hasLocation)
                  MapPin(
                    lat: s.lat!,
                    lng: s.lng!,
                    label: s.name,
                    number: i + 1,
                    onTap: () {
                      Navigator.pop(d);
                      context.push('/place/${s.placeId}');
                    },
                  ),
            ],
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.sm),
              child: IconButton.filled(
                tooltip: tr('Close'),
                onPressed: () => Navigator.pop(d),
                icon: const Icon(Icons.close),
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Sunset time when the plan has outdoor stops, and a fixed public holiday
/// on the outing day. Worked out from the date and real coordinates.
String? _dayFacts(OutingPlan plan) {
  final day = plan.request.day;
  final outdoor = plan.stops.where((s) => s.hasLocation && (s.category == 'park' || s.category == 'sight'));
  final at = outdoor.firstOrNull;
  final c = at != null ? (at.lat!, at.lng!) : cityCenters[plan.request.city];
  final sun = outdoor.isEmpty || c == null ? null : sunTimes(day, c.$1, c.$2);
  final holiday = egyptHoliday(day);
  final start = plan.stops.firstOrNull?.startTime;
  final end = planEndTime(plan.stops);
  final spot = plan.stops.where((s) => s.hasLocation).firstOrNull;
  final city = cityCenters[plan.request.city];
  final pray = start == null || end == null
      ? const <(String, String)>[]
      : prayersDuring(day, start, end, spot?.lat ?? city?.$1 ?? 30.0444, spot?.lng ?? city?.$2 ?? 31.2357);
  final lines = [
    if (pray.isNotEmpty)
      trf('🕌 During your outing: {list}', {'list': readableList([for (final (n, t) in pray) '$n $t'])}),
    if (sun != null) trf('Sunset at {time}. Outdoor stops are nicest before then.', {'time': hhmmLocal(sun.sunset)}),
    if (holiday != null) trf('{name} is a public holiday: places may be busier and hours may differ.', {'name': holiday}),
  ];
  return lines.isEmpty ? null : lines.join('\n');
}

/// The plan as a story-size picture card.
Widget planStoryCard(OutingPlan plan) => StoryCard(
      emoji: '🗺️',
      title: plan.title,
      subtitle: [
        if (plan.request.date != null) DateFormat('EEEE d MMM').format(plan.request.day),
        tr(Cities.all[plan.request.city] ?? plan.request.city),
      ].join(' · '),
      lines: [
        for (final s in plan.stops)
          (Categories.emoji(s.category), s.name, [?s.startTime, ?s.area].join(' · ')),
      ],
    );

/// Flag offensive or wrong AI-written words (Google Play's AI content rule).
Future<void> _reportAi(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final reason = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (c) => ListView(shrinkWrap: true, children: [
      ListTile(title: Text(tr('What\'s wrong with the AI text?'), style: Theme.of(c).textTheme.titleMedium)),
      for (final r in const ['Offensive or inappropriate', 'Wrong or made-up information', 'Something else'])
        ListTile(title: Text(tr(r)), onTap: () => Navigator.pop(c, r)),
    ]),
  );
  if (reason == null) return;
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  try {
    await ref.read(safetyRepositoryProvider).reportAiText(
          by: uid,
          reason: reason,
          text: [plan.title, plan.summary, ...plan.tips, for (final s in plan.stops) ?s.why].join('\n'),
        );
    if (context.mounted) showMessage(context, tr('Thanks. We\'ll look at it.'));
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// The stop's real photo (Wikimedia Commons) when our data has one.
class _StopPhoto extends ConsumerWidget {
  const _StopPhoto({required this.stop});

  final PlanStop stop;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final photo = ref.watch(placeProvider(stop.placeId)).value?.photoUrl;
    return PlaceImage(url: photo, emoji: Categories.emoji(stop.category), width: 56, height: 56);
  }
}

/// "🌤️ 27° · 10% rain at 18:00" from the real hourly forecast (Open-Meteo),
/// when the outing day is within the forecast range.
class _StopWeather extends ConsumerWidget {
  const _StopWeather({required this.stop, required this.day});

  final PlanStop stop;
  final DateTime day;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final today = DateTime.now();
    final ahead = DateTime(day.year, day.month, day.day).difference(DateTime(today.year, today.month, today.day)).inDays;
    if (!stop.hasLocation || stop.startTime == null || ahead < 0 || ahead > 15) return const SizedBox.shrink();
    final key = (
      // ~10 km grid: one forecast request covers a whole plan.
      (stop.lat! * 10).round() / 10,
      (stop.lng! * 10).round() / 10,
      DateFormat('yyyy-MM-dd').format(day),
    );
    final w = weatherAt(ref.watch(hourlyWeatherProvider(key)).value ?? const {}, stop.startTime);
    if (w == null) return const SizedBox.shrink();
    final icon = w.rain >= 40 ? '🌧️' : w.temp >= 35 ? '🥵' : w.temp <= 14 ? '🧥' : '🌤️';
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Text(trf('{icon} {t}° · {r}% rain then', {'icon': icon, 't': w.temp.round(), 'r': w.rain}),
          style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
