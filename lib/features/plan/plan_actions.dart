import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/i18n.dart';
import 'plan_result_screen.dart' show planShareText;
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import 'plan_form_screen.dart' show runPlanGeneration;
import 'plan_glance.dart';
import 'reminder_sheet.dart' show forgetReminder;
import '../../app/local_prefs.dart' show pinnedPlansProvider;

/// Everything you can do with a plan, in one tidy sheet (from "My plans",
/// or "More" on a plan).
Future<void> showPlanActions(BuildContext context, WidgetRef ref, OutingPlan plan,
    {bool fromPlan = false, List<(IconData, String, VoidCallback)> extras = const []}) {
  Widget row(IconData icon, String label, VoidCallback onTap, {bool danger = false}) => ListTile(
        leading: IconTile(icon, hue: danger ? 0 : null),
        title: Text(label, style: danger ? TextStyle(color: Theme.of(context).colorScheme.error) : null),
        onTap: onTap,
      );
  return showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheet) {
      void then(Future<void> Function() action) {
        Navigator.pop(sheet);
        action();
      }

      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.lg),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(plan.title,
              style: Theme.of(sheet).textTheme.titleLarge, maxLines: 2, overflow: TextOverflow.ellipsis),
          const SizedBox(height: KSpace.md),
          if (extras.isNotEmpty) ...[
            MenuGroup(title: tr('This plan'), children: [
              for (final (icon, label, onTap) in extras) row(icon, label, () => then(() async => onTap())),
            ]),
            const SizedBox(height: KSpace.md),
          ],
          MenuGroup(children: [
            if (!fromPlan) row(Icons.open_in_new, tr('Open'), () => then(() async => context.push('/plan/${plan.id}'))),
            row(Icons.event_outlined, tr('Change the day'), () => then(() => changePlanDay(context, ref, plan))),
            row(Icons.edit_outlined, tr('Rename'), () => then(() => renamePlan(context, ref, plan))),
            row(Icons.label_outline, tr('Label'), () => then(() => choosePlanTag(context, ref, plan))),
            row(Icons.sticky_note_2_outlined, tr('Private note'), () => then(() => editPlanNote(context, ref, plan))),
            row(ref.read(pinnedPlansProvider).containsKey(plan.id) ? Icons.push_pin : Icons.push_pin_outlined,
                ref.read(pinnedPlansProvider).containsKey(plan.id) ? tr('Unpin') : tr('Pin to the top'),
                () => then(() async => togglePinPlan(context, ref, plan))),
            row(plan.saved ? Icons.bookmark_remove_outlined : Icons.bookmark_add_outlined,
                plan.saved ? tr('Remove from saved') : tr('Save'), () => then(() async {
              final uid = ref.read(uidProvider);
              if (uid == null) return;
              await ref.read(plansRepositoryProvider).setSaved(uid, plan.id, !plan.saved);
            })),
          ]),
          const SizedBox(height: KSpace.md),
          MenuGroup(children: [
            row(Icons.copy_all_outlined, tr('Make a copy'), () => then(() => copyPlan(context, ref, plan))),
            row(Icons.refresh, tr('Plan again (new places)'), () => then(() => planAgain(context, ref, plan))),
            row(Icons.ios_share, tr('Share'),
                () => then(() => SharePlus.instance.share(ShareParams(text: planShareText(plan))))),
            row(Icons.forum_outlined, tr('Send to a group chat'), () => then(() => sendPlanToGroup(context, ref, plan))),
          ]),
          const SizedBox(height: KSpace.md),
          MenuGroup(children: [
            row(Icons.delete_outline, tr('Delete'), () => then(() => deletePlan(context, ref, plan, leave: fromPlan)),
                danger: true),
          ]),
        ]),
      );
    },
  );
}

/// Moves the outing to another day (weather and "open then" follow the new day).
Future<void> changePlanDay(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final current = plan.request.date == null ? today : plan.request.day;
  final picked = await showDatePicker(
    context: context,
    initialDate: current.isBefore(today) ? today : current,
    firstDate: today,
    lastDate: today.add(const Duration(days: 365)),
    helpText: tr('Which day is the outing?'),
  );
  if (picked == null) return;
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  try {
    await ref.read(plansRepositoryProvider).setDay(uid, plan.id, picked);
    if (context.mounted) {
      showMessage(context, trf('Moved to {day}', {'day': DateFormat('EEE d MMM').format(picked)}));
    }
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

Future<void> renamePlan(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final controller = TextEditingController(text: plan.title);
  final name = await showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(tr('Rename plan')),
      content: TextField(controller: controller, autofocus: true, maxLength: 80),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: Text(tr('Cancel'))),
        FilledButton(onPressed: () => Navigator.pop(c, controller.text.trim()), child: Text(tr('Save'))),
      ],
    ),
  );
  controller.dispose();
  final uid = ref.read(uidProvider);
  if (name == null || name.isEmpty || uid == null) return;
  try {
    await ref.read(plansRepositoryProvider).rename(uid, plan.id, name);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

Future<void> copyPlan(BuildContext context, WidgetRef ref, OutingPlan plan) async {
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

/// Same choices, different real places.
Future<void> planAgain(BuildContext context, WidgetRef ref, OutingPlan plan) async {
  final exclude = {...plan.request.excludePlaceIds, ...plan.stops.map((s) => s.placeId)};
  final id = await runPlanGeneration(context, ref, plan.request.copyWith(excludePlaceIds: exclude.toList()));
  if (id != null && context.mounted) context.push('/plan/$id');
}

Future<void> deletePlan(BuildContext context, WidgetRef ref, OutingPlan plan, {bool leave = false}) async {
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final repo = ref.read(plansRepositoryProvider);
  try {
    await repo.delete(uid, plan.id);
    // No reminder for a plan that's gone.
    forgetReminder(ref, 'plan:${plan.id}');
    if (!context.mounted) return;
    showUndo(context, tr('Plan deleted'), () => repo.restore(uid, plan));
    if (leave && context.canPop()) context.pop();
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

Future<void> sendPlanToGroup(BuildContext context, WidgetRef ref, OutingPlan plan) async {
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
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.md),
      children: [
        Text(tr('Send to which group?'), style: Theme.of(sheetContext).textTheme.titleLarge),
        for (final g in groups)
          ListTile(
            leading: const IconTile(Icons.forum_outlined),
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
}
