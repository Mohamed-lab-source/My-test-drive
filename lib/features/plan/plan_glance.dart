import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show Clipboard, ClipboardData;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/extras.dart' show cityCenters, durationText;
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/pocket.dart';
import '../../app/theme.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

/// 2.0: a plan at a glance (all worked out on the phone from the plan
/// itself) plus your own label and private note for it.
class PlanGlance extends ConsumerWidget {
  const PlanGlance({super.key, required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.k;
    final text = Theme.of(context).textTheme;
    final tag = ref.watch(planTagsProvider)[plan.id];
    final note = ref.watch(planNotesProvider)[plan.id];
    final done = ref.watch(planChecklistProvider);
    final ticked = plan.stops.where((s) => done.contains(PlanChecklist.keyFor(plan.id, s.placeId))).length;
    final span = planSpanMinutes(plan.stops);
    final km = planWalkKm(plan.stops);
    final mix = categoryMix(plan.stops);
    final spot = plan.stops.where((s) => s.hasLocation).firstOrNull;
    final city = cityCenters[plan.request.city];
    final lat = spot?.lat ?? city?.$1, lng = spot?.lng ?? city?.$2;
    final night = lat == null || plan.request.date == null
        ? const <int>{}
        : stopsAfterSunset(plan.stops, plan.request.day, lat, lng!);

    final lines = <(IconData, String)>[
      if (span != null) (Icons.schedule, trf('Out for about {t}', {'t': durationText(span)})),
      if (km > 0)
        (
          Icons.directions_walk,
          trf('{km} km between stops (straight line) · about {steps} steps and {kcal} kcal, rough',
              {'km': km.toStringAsFixed(1), 'steps': roughSteps(km), 'kcal': roughKcal(km)}),
        ),
      if (night.isNotEmpty)
        (
          Icons.nightlight_outlined,
          night.length == plan.stops.length
              ? tr('The whole outing is after sunset')
              : trf('{n} of {m} stops are after sunset', {'n': night.length, 'm': plan.stops.length}),
        ),
    ];

    return Padding(
      padding: const EdgeInsets.only(top: KSpace.md),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(tr('At a glance'), style: text.titleMedium)),
              ActionChip(
                visualDensity: VisualDensity.compact,
                avatar: tag == null ? const Icon(Icons.label_outline, size: 16) : null,
                label: Text(tag == null ? tr('Add a label') : '${planTags[tag] ?? ''} ${planTagLabel(tag)}'),
                onPressed: () => choosePlanTag(context, ref, plan),
              ),
            ]),
            const SizedBox(height: KSpace.xs),
            // Progress of ticked stops.
            Row(children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: plan.stops.isEmpty ? 0 : ticked / plan.stops.length,
                    minHeight: 8,
                    backgroundColor: k.surfaceHigh,
                    color: ticked == plan.stops.length && ticked > 0 ? k.signal : k.ink,
                  ),
                ),
              ),
              const SizedBox(width: KSpace.sm),
              Text(trf('{n} of {m} done', {'n': ticked, 'm': plan.stops.length}), style: text.bodySmall),
            ]),
            const SizedBox(height: KSpace.sm),
            for (final (icon, line) in lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(icon, size: 18, color: k.inkMuted),
                  const SizedBox(width: KSpace.sm),
                  Expanded(child: Text(line, style: text.bodyMedium)),
                ]),
              ),
            if (mix.isNotEmpty)
              Text(mix.map((e) => '${Categories.emoji(e.key)} ×${e.value}').join('   '), style: text.bodyMedium),
            const SizedBox(height: KSpace.sm),
            InkWell(
              borderRadius: BorderRadius.circular(KRadius.card),
              onTap: () => editPlanNote(context, ref, plan),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(KSpace.sm),
                decoration: BoxDecoration(color: k.surfaceHigh, borderRadius: BorderRadius.circular(KRadius.card)),
                child: Text(
                  note == null ? tr('📝 Add a private note (only on this phone)') : '📝 $note',
                  style: note == null ? text.bodySmall : text.bodyMedium,
                ),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

/// Pick a label for a plan (or none). Kept on this phone.
Future<void> choosePlanTag(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final current = ref.read(planTagsProvider)[plan.id];
  final picked = await showModalBottomSheet<String>(
    context: context,
    useSafeArea: true,
    builder: (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.lg),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(tr('Label this plan'), style: Theme.of(sheet).textTheme.titleLarge),
        const SizedBox(height: KSpace.sm),
        Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
          for (final e in planTags.entries)
            ChoiceChip(
              label: Text('${e.value} ${planTagLabel(e.key)}'),
              selected: current == e.key,
              showCheckmark: false,
              onSelected: (_) => Navigator.pop(sheet, e.key),
            ),
          if (current != null)
            ActionChip(label: Text(tr('No label')), onPressed: () => Navigator.pop(sheet, '')),
        ]),
      ]),
    ),
  );
  if (picked == null) return;
  ref.read(planTagsProvider.notifier).set(plan.id, picked.isEmpty ? null : picked);
}

/// Your private note on a plan, kept on this phone (max 300 letters).
Future<void> editPlanNote(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final controller = TextEditingController(text: ref.read(planNotesProvider)[plan.id] ?? '');
  final text = await showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(tr('Private note')),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 300,
        minLines: 2,
        maxLines: 6,
        decoration: InputDecoration(hintText: tr('Only you see this, on this phone.')),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: Text(tr('Cancel'))),
        FilledButton(onPressed: () => Navigator.pop(c, controller.text.trim()), child: Text(tr('Save'))),
      ],
    ),
  );
  disposeLater(controller);
  if (text == null) return;
  ref.read(planNotesProvider.notifier).set(plan.id, text.isEmpty ? null : text);
}

/// Pin / unpin a plan at the top of My plans (on this phone).
void togglePinPlan(BuildContext context, WidgetRef ref, OutingPlan plan) {
  final pinned = ref.read(pinnedPlansProvider).containsKey(plan.id);
  ref.read(pinnedPlansProvider.notifier).set(plan.id, pinned ? null : DateTime.now().toIso8601String());
  showMessage(context, pinned ? tr('Unpinned') : tr('Pinned to the top of My plans'));
}

/// Copies the plan as a ticklist (☑ done / ☐ not yet).
void copyChecklist(BuildContext context, WidgetRef ref, OutingPlan plan) {
  final done = {
    for (final s in plan.stops)
      if (ref.read(planChecklistProvider).contains(PlanChecklist.keyFor(plan.id, s.placeId))) s.placeId,
  };
  Clipboard.setData(ClipboardData(text: checklistText(plan, done)));
  showMessage(context, tr('Copied as a checklist'));
}

/// Unticks every stop of the plan.
void resetTicks(WidgetRef ref, OutingPlan plan) {
  final list = ref.read(planChecklistProvider.notifier);
  for (final s in plan.stops) {
    if (ref.read(planChecklistProvider).contains(PlanChecklist.keyFor(plan.id, s.placeId))) {
      list.toggle(plan.id, s.placeId);
    }
  }
}
