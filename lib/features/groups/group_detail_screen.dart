import '../plan/reminder_sheet.dart' show ReminderButton;
import '../../app/fun.dart' show nextDays;
import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/extras.dart';
import '../../app/helpers.dart';
import '../../app/share_texts.dart';
import '../../app/links.dart' show appRouteFor;
import '../../app/web_host.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../data/groups_repository.dart' show shouldUpdatePreview;
import '../../models/social.dart';
import '../../planner/planner.dart' show routeMapsUrl;
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import '../friends/friends_screen.dart' show groupQrPrefix;
import 'create_group_sheet.dart';
import '../profile/community_rules.dart';

class GroupDetailScreen extends ConsumerWidget {
  const GroupDetailScreen({super.key, required this.groupId});

  final String groupId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final group = ref.watch(groupProvider(groupId));
    final uid = ref.watch(uidProvider);
    return group.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          emoji: '🔒',
          title: tr("Can't open this group"),
          message: friendlyError(e),
        ),
      ),
      data: (g) {
        if (g == null || uid == null || !g.memberUids.contains(uid)) {
          return Scaffold(
            appBar: AppBar(),
            body: EmptyState(
              emoji: '👋',
              title: tr("You're not in this group"),
              message: tr('It may have been deleted, or you left it.'),
            ),
          );
        }
        return _GroupView(group: g, uid: uid);
      },
    );
  }
}

class _GroupView extends ConsumerStatefulWidget {
  const _GroupView({required this.group, required this.uid});

  final Group group;
  final String uid;

  @override
  ConsumerState<_GroupView> createState() => _GroupViewState();
}

class _GroupViewState extends ConsumerState<_GroupView> {
  String? _search; // null = not searching
  final _replyTo = ValueNotifier<GroupMessage?>(null);
  bool _showHeader = true;
  late final StringMapPref _opened;

  void _markRead() => _opened.set(widget.group.id, DateTime.now().toIso8601String());

  @override
  void initState() {
    super.initState();
    _opened = ref.read(groupOpenedProvider.notifier);
    WidgetsBinding.instance.addPostFrameCallback((_) => _markRead());
  }

  @override
  void dispose() {
    _replyTo.dispose();
    _markRead(); // messages read while the chat was open
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final uid = widget.uid;
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final profiles =
        ref.watch(profilesProvider(profilesKey(group.memberUids))).value ??
            const {};
    final polls = ref.watch(groupPollsProvider(group.id)).value ?? const <Poll>[];
    final isOwner = group.isOwner(uid);
    return Scaffold(
      appBar: AppBar(
        title: _search == null
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(group.name, overflow: TextOverflow.ellipsis),
                  Text(
                    '${group.memberUids.length} member${group.memberUids.length == 1 ? '' : 's'}'
                    '${group.scheduledAt == null ? '' : ' · ${DateFormat('EEE d MMM').format(group.scheduledAt!)}'}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              )
            : TextField(
                autofocus: true,
                decoration: InputDecoration(hintText: tr('Search messages'), isDense: true),
                onChanged: (v) => setState(() => _search = v),
              ),
        actions: [
          IconButton(
            tooltip: _search == null ? tr('Search messages') : tr('Close search'),
            icon: Icon(_search == null ? Icons.search : Icons.close),
            onPressed: () => setState(() => _search = _search == null ? '' : null),
          ),
          if (group.scheduledAt case final meetAt? when meetAt.isAfter(DateTime.now()))
            ReminderButton(
              reminderKey: 'group:${group.id}',
              title: group.planTitle ?? group.name,
              route: '/group/${group.id}',
              fixedStart: meetAt,
            ),
          IconButton(
            tooltip: tr('Polls'),
            icon: Badge(
              isLabelVisible: polls.isNotEmpty,
              label: Text('${polls.length}'),
              child: const Icon(Icons.how_to_vote_outlined),
            ),
            onPressed: () => _showPolls(context, group, uid),
          ),
          IconButton(
            tooltip: tr('Members'),
            icon: const Icon(Icons.people_outline),
            onPressed: () => _showMembers(context, group, uid),
          ),
          if (isOwner)
            PopupMenuButton<String>(
              onSelected: (v) => switch (v) {
                'rename' => _renameGroup(context, ref, group),
                'pin' => _pinNote(context, ref, group),
                _ => _pickMeetingPoint(context, ref, group),
              },
              itemBuilder: (_) => [
                PopupMenuItem(value: 'rename', child: Text(tr('Rename group'))),
                PopupMenuItem(value: 'pin', child: Text(tr('Pin a note'))),
                PopupMenuItem(value: 'meet', child: Text(tr('Set meeting point'))),
              ],
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // While typing, hide the header so the chat keeps its space.
            if (!keyboardOpen && _search == null)
              _showHeader
                  ? Stack(
                      children: [
                        _Header(group: group, uid: uid),
                        PositionedDirectional(
                          end: KSpace.md + 4,
                          top: 4,
                          child: IconButton(
                            tooltip: tr('Hide details'),
                            visualDensity: VisualDensity.compact,
                            icon: const Icon(Icons.expand_less),
                            onPressed: () => setState(() => _showHeader = false),
                          ),
                        ),
                      ],
                    )
                  : TextButton.icon(
                      onPressed: () => setState(() => _showHeader = true),
                      icon: const Icon(Icons.expand_more),
                      label: Text(tr('Show details')),
                    ),
            if (group.pinned != null && _search == null)
              Padding(
                padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xs),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(KSpace.sm),
                  decoration: BoxDecoration(
                    color: context.k.accentSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text('📌 ${group.pinned}'),
                ),
              ),
            Expanded(
                child: _Chat(
                    group: group, uid: uid, profiles: profiles, search: _search, replyTo: _replyTo)),
            if (_search == null) _Composer(group: group, uid: uid, replyTo: _replyTo),
          ],
        ),
      ),
    );
  }
}

Future<void> _renameGroup(BuildContext context, WidgetRef ref, Group group) async {
  final controller = TextEditingController(text: group.name);
  final name = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('Rename group')),
      content: TextField(controller: controller, autofocus: true, maxLength: 40),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(tr('Save'))),
      ],
    ),
  );
  controller.dispose();
  if (name == null || name.trim().isEmpty) return;
  try {
    await ref.read(groupsRepositoryProvider).rename(group.id, name);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

Future<void> _pinNote(BuildContext context, WidgetRef ref, Group group) async {
  final controller = TextEditingController(text: group.pinned ?? '');
  final text = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('Pin a note')),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 300,
        maxLines: 3,
        decoration: InputDecoration(hintText: tr('e.g. Meet at gate 3 at 7 pm')),
      ),
      actions: [
        if (group.pinned != null)
          TextButton(onPressed: () => Navigator.pop(dialogContext, ''), child: Text(tr('Unpin'))),
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(tr('Pin'))),
      ],
    ),
  );
  controller.dispose();
  if (text == null) return;
  try {
    await ref.read(groupsRepositoryProvider).setPinned(group.id, text);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

/// The organizer picks where everyone meets: a stop from the plan or a favorite.
Future<void> _pickMeetingPoint(BuildContext context, WidgetRef ref, Group group) async {
  final favorites = await ref.read(favoritePlacesProvider.future);
  final options = <(String, String)>[
    for (final raw in group.planStops)
      if (raw['placeId'] is String && raw['name'] is String) (raw['placeId'] as String, raw['name'] as String),
    for (final p in favorites.take(20)) (p.id, p.name),
  ];
  final seen = <String>{};
  options.retainWhere((o) => seen.add(o.$1));
  if (!context.mounted) return;
  final picked = await showModalBottomSheet<(String, String)?>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          Text(tr('Where do we meet?'), style: Theme.of(sheetContext).textTheme.titleLarge),
          const SizedBox(height: KSpace.xs),
          Text(tr('Pick a stop from the plan or one of your favorites.'),
              style: Theme.of(sheetContext).textTheme.bodySmall),
          if (options.isEmpty)
            Padding(
              padding: EdgeInsets.all(KSpace.md),
              child: Text(tr('Attach a plan or save some favorite places first.')),
            ),
          for (final o in options)
            ListTile(
              leading: const Icon(Icons.place_outlined),
              title: Text(o.$2),
              onTap: () => Navigator.pop(sheetContext, o),
            ),
          if (group.meetPlaceId != null)
            ListTile(
              leading: const Icon(Icons.close),
              title: Text(tr('No meeting point')),
              onTap: () => Navigator.pop(sheetContext, ('', '')),
            ),
        ],
      ),
    ),
  );
  if (picked == null) return;
  try {
    await ref.read(groupsRepositoryProvider).setMeetingPoint(group.id,
        placeId: picked.$1.isEmpty ? null : picked.$1,
        placeName: picked.$2.isEmpty ? null : picked.$2);
  } catch (e) {
    if (context.mounted) showError(context, e);
  }
}

class _Header extends ConsumerWidget {
  const _Header({required this.group, required this.uid});

  final Group group;
  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final repo = ref.read(groupsRepositoryProvider);
    final mine = group.rsvp[uid];
    final going = group.rsvp.values.where((r) => r == Rsvp.going).length;
    final maybe = group.rsvp.values.where((r) => r == Rsvp.maybe).length;
    final cant = group.rsvp.values.where((r) => r == Rsvp.notGoing).length;
    final waiting = group.memberUids.where((u) => !group.rsvp.containsKey(u)).length;
    final isOwner = group.isOwner(uid);

    return Padding(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.sm),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.event_outlined, size: 20),
                  const SizedBox(width: KSpace.sm),
                  Expanded(
                    child: Text(
                      group.scheduledAt == null
                          ? tr('No date yet')
                          : DateFormat('EEE d MMM · h:mm a')
                              .format(group.scheduledAt!),
                      style: text.titleMedium,
                    ),
                  ),
                  if (isOwner)
                    TextButton(
                      onPressed: () async {
                        final when = await pickDateTime(context, group.scheduledAt);
                        if (when == null) return;
                        try {
                          await repo.setSchedule(group.id, when);
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                      child: Text(group.scheduledAt == null ? tr('Set') : tr('Change')),
                    ),
                ],
              ),
              if (group.scheduledAt != null) _OutingDay(group: group),
              if (group.memberUids.length == 1)
                Padding(
                  padding: const EdgeInsets.only(top: KSpace.sm),
                  child: FilledButton.icon(
                    icon: const Icon(Icons.group_add_outlined),
                    label: Text(tr('Invite friends with a link')),
                    onPressed: () => SharePlus.instance
                        .share(ShareParams(text: groupInviteText(group.name, group.joinCode))),
                  ),
                ),
              if (group.planTitle != null) ...[
                const SizedBox(height: KSpace.xs),
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: () => _showPlan(context, group),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: KSpace.xs),
                    child: Row(
                      children: [
                        const Icon(Icons.map_outlined, size: 20),
                        const SizedBox(width: KSpace.sm),
                        Expanded(
                          child: Text(
                            '${group.planTitle} · ${trf('{n} stops', {'n': group.planStops.length})}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(Icons.chevron_right, size: 20),
                      ],
                    ),
                  ),
                ),
              ],
              if (group.meetPlaceName != null)
                InkWell(
                  borderRadius: BorderRadius.circular(8),
                  onTap: group.meetPlaceId == null
                      ? null
                      : () => context.push('/place/${group.meetPlaceId}'),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: KSpace.xs),
                    child: Row(
                      children: [
                        const Icon(Icons.flag_outlined, size: 20),
                        const SizedBox(width: KSpace.sm),
                        Expanded(child: Text(trf('Meet at {place}', {'place': group.meetPlaceName}))),
                        const Icon(Icons.chevron_right, size: 20),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: KSpace.sm),
              Row(
                children: [
                  Expanded(
                    child: SegmentedButton<Rsvp>(
                      showSelectedIcon: false,
                      emptySelectionAllowed: true,
                      segments: [
                        for (final r in Rsvp.values)
                          ButtonSegment(value: r, label: Text(tr(r.label))),
                      ],
                      selected: {?mine},
                      onSelectionChanged: (s) async {
                        if (s.isEmpty) return;
                        try {
                          await repo.setRsvp(group.id, uid, s.first);
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: KSpace.xs),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      [
                        '✅ $going going',
                        if (maybe > 0) '🤔 $maybe maybe',
                        if (cant > 0) "❌ $cant can't",
                        if (waiting > 0) '⏳ $waiting no answer',
                      ].join('  '),
                      style: text.bodySmall,
                    ),
                  ),
                  if (group.scheduledAt != null)
                    Text(countdownText(group.scheduledAt!),
                        style: text.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                ],
              ),
              const SizedBox(height: KSpace.xs),
              Wrap(
                spacing: KSpace.sm,
                runSpacing: KSpace.xs,
                children: [
                  if (group.scheduledAt != null)
                    ActionChip(
                      avatar: const Icon(Icons.event_available, size: 18),
                      label: Text(tr('Add to calendar')),
                      onPressed: () => openUri(calendarLink(group)),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.calculate_outlined, size: 18),
                    label: Text(tr('Split the bill')),
                    onPressed: () => _showBillSplitter(context, group),
                  ),
                  if (routeMapsUrl([for (final s in group.planStops) PlanStop.fromMap(s)]) case final url?) ...[
                    ActionChip(
                      avatar: const Icon(Icons.route_outlined, size: 18),
                      label: Text(tr('Route')),
                      onPressed: () => openUri(url),
                    ),
                    ActionChip(
                      avatar: const Icon(Icons.send_outlined, size: 18),
                      label: Text(tr('Send route to chat')),
                      onPressed: () async {
                        try {
                          await repo.sendMessage(
                            groupId: group.id,
                            uid: uid,
                            name: ref.read(myProfileProvider).value?.displayName ?? tr('Someone'),
                            text: '${tr('🗺️ Our route')}: $url',
                          );
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    ),
                  ],
                  if (waiting > 0)
                    ActionChip(
                      avatar: const Icon(Icons.campaign_outlined, size: 18),
                      label: Text(tr('Nudge')),
                      onPressed: () async {
                        final waitingUids =
                            group.memberUids.where((u) => !group.rsvp.containsKey(u)).toList();
                        final profiles =
                            await ref.read(profilesProvider(profilesKey(waitingUids)).future);
                        final names = waitingUids.map((u) => profiles[u]?.displayName ?? 'someone');
                        try {
                          await repo.sendMessage(
                            groupId: group.id,
                            uid: uid,
                            name: ref.read(myProfileProvider).value?.displayName ?? 'Someone',
                            text: trf('👋 Still waiting to hear from {names}. Are you coming? '
                                "Tap Going / Maybe / Can't at the top.", {'names': names.join('، ')}),
                          );
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    ),
                  if (group.scheduledAt != null && group.scheduledAt!.isAfter(DateTime.now()))
                    ActionChip(
                      avatar: const Icon(Icons.notifications_active_outlined, size: 18),
                      label: Text(tr('Remind everyone')),
                      onPressed: () async {
                        try {
                          await repo.sendMessage(
                            groupId: group.id,
                            uid: uid,
                            name: ref.read(myProfileProvider).value?.displayName ?? 'Someone',
                            text: trf("⏰ Reminder: {group} is {when} ({date}). Tap Going / Maybe / Can't above!", {
                              'group': group.name,
                              'when': countdownText(group.scheduledAt!).replaceFirst('⏳ ', ''),
                              'date': DateFormat('EEE d MMM, h:mm a').format(group.scheduledAt!),
                            }),
                          );
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

void _showPlan(BuildContext context, Group group) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.6,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(group.planTitle ?? 'Plan',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.md),
          for (final (i, raw) in group.planStops.indexed)
            Builder(builder: (_) {
              final stop = PlanStop.fromMap(raw);
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: context.k.accent,
                  foregroundColor: context.k.onAccent,
                  child: Text('${i + 1}'),
                ),
                title: Text(stop.name),
                subtitle: Text([
                  ?stop.startTime,
                  '${Categories.emoji(stop.category)} ${Categories.label(stop.category)}',
                ].join(' · ')),
                onTap: () {
                  Navigator.of(sheetContext).pop();
                  context.push('/place/${stop.placeId}');
                },
              );
            }),
        ],
      ),
    ),
  );
}

void _showMembers(BuildContext context, Group group, String uid) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _MembersSheet(groupId: group.id, uid: uid),
  );
}

class _MembersSheet extends ConsumerWidget {
  const _MembersSheet({required this.groupId, required this.uid});

  final String groupId;
  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the live group so changes show while the sheet is open.
    final group = ref.watch(groupProvider(groupId)).value;
    if (group == null) return const SizedBox(height: 200);
    final profiles =
        ref.watch(profilesProvider(profilesKey(group.memberUids))).value ??
            const {};
    final isOwner = group.isOwner(uid);
    final repo = ref.read(groupsRepositoryProvider);
    final paying = group.payingUids.length;
    final text = Theme.of(context).textTheme;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      builder: (_, controller) => ListView(
        controller: controller,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(tr('Members'), style: text.titleLarge),
          const SizedBox(height: KSpace.md),
          // Join code
          Card(
            child: ListTile(
              title: Text(tr('Invite code')),
              subtitle: Text(group.joinCode,
                  style: TextStyle(
                      fontSize: 22,
                      letterSpacing: 4,
                      fontWeight: FontWeight.w800,
                      color: context.k.ink)),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: tr('Copy'),
                    icon: const Icon(Icons.copy),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: group.joinCode));
                      showMessage(context, tr('Code copied'));
                    },
                  ),
                  IconButton(
                    tooltip: tr('Share'),
                    icon: const Icon(Icons.share_outlined),
                    onPressed: () => SharePlus.instance.share(ShareParams(
                      text: groupInviteText(group.name, group.joinCode),
                    )),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton.icon(
            onPressed: () => showDialog<void>(
              context: context,
              builder: (dialogContext) => AlertDialog(
                title: Text(trf('Join "{group}"', {'group': group.name}), textAlign: TextAlign.center),
                content: SizedBox(
                  width: 240,
                  height: 280,
                  child: Column(
                    children: [
                      Container(
                        color: Colors.white, // QR codes need a light background to scan
                        padding: const EdgeInsets.all(8),
                        child: QrImageView(data: '$groupQrPrefix${group.joinCode}', size: 220),
                      ),
                      const SizedBox(height: KSpace.sm),
                      Text(tr('Friends scan this from Friends → Scan')),
                    ],
                  ),
                ),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Done'))),
                ],
              ),
            ),
            icon: const Icon(Icons.qr_code),
            label: Text(tr('Show invite QR code')),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton.icon(
            onPressed: () => _inviteFriend(context, ref, group),
            icon: const Icon(Icons.person_add_alt),
            label: Text(tr('Add a friend')),
          ),
          SectionTitle(tr('Who pays')),
          Text(
            paying == 0
                ? tr('Nobody has said "Going" yet.')
                : trf('{n} people split the bill.', {'n': paying}) +
                    (isOwner ? tr(' Tap "Free" for anyone who doesn\'t pay.') : ''),
            style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
          ),
          const SizedBox(height: KSpace.sm),
          for (final memberUid in group.memberUids)
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Avatar(profile: profiles[memberUid]),
              title: Text(
                (profiles[memberUid]?.displayName ?? '…') +
                    (memberUid == uid ? ' (you)' : ''),
              ),
              subtitle: Text([
                if (group.isOwner(memberUid)) 'Organizer',
                group.rsvp[memberUid]?.label ?? 'No answer yet',
                if (group.freeUids.contains(memberUid)) 'Free',
              ].join(' · ')),
              trailing: isOwner
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        FilterChip(
                          label: Text(tr('Free')),
                          showCheckmark: false,
                          selected: group.freeUids.contains(memberUid),
                          onSelected: (on) async {
                            try {
                              await repo.setFree(group.id, memberUid, on);
                            } catch (e) {
                              if (context.mounted) showError(context, e);
                            }
                          },
                        ),
                        if (memberUid != uid)
                          PopupMenuButton<String>(
                            onSelected: (_) async {
                              final ok = await showDialog<bool>(
                                context: context,
                                builder: (d) => AlertDialog(
                                  title: Text(trf('Remove {name}?', {'name': profiles[memberUid]?.displayName ?? tr('this person')})),
                                  actions: [
                                    TextButton(
                                        onPressed: () => Navigator.pop(d, false),
                                        child: Text(tr('Cancel'))),
                                    FilledButton(
                                        onPressed: () => Navigator.pop(d, true),
                                        child: Text(tr('Remove'))),
                                  ],
                                ),
                              );
                              if (ok != true) return;
                              try {
                                await repo.removeMember(group.id, memberUid);
                              } catch (e) {
                                if (context.mounted) showError(context, e);
                              }
                            },
                            itemBuilder: (_) => [
                              PopupMenuItem(value: 'remove', child: Text(tr('Remove from group'))),
                            ],
                          ),
                      ],
                    )
                  : null,
            ),
          const SizedBox(height: KSpace.lg),
          TextButton(
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => _leaveOrDelete(context, ref, group, isOwner),
            child: Text(isOwner ? tr('Delete group') : tr('Leave group')),
          ),
        ],
      ),
    );
  }

  Future<void> _leaveOrDelete(
      BuildContext context, WidgetRef ref, Group group, bool isOwner) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isOwner ? tr('Delete this group?') : tr('Leave this group?')),
        content: Text(isOwner
            ? tr('The group and all its messages will be deleted for everyone.')
            : tr("You'll need a new invite code to come back.")),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(tr('Cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(isOwner ? tr('Delete') : tr('Leave'))),
        ],
      ),
    );
    if (ok != true || !context.mounted) return;
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final repo = ref.read(groupsRepositoryProvider);
    try {
      Navigator.of(context).pop(); // close the sheet
      if (isOwner) {
        await repo.delete(group);
      } else {
        await repo.leave(group.id, uid);
      }
      router.go('/groups');
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
    }
  }

  Future<void> _inviteFriend(
      BuildContext context, WidgetRef ref, Group group) async {
    final friendships = ref.read(friendshipsProvider).value ?? const [];
    final friendUids = friendships
        .where((f) => f.status == FriendshipStatus.accepted)
        .map((f) => f.otherUid(uid))
        .where((u) => !group.memberUids.contains(u))
        .toList();
    if (friendUids.isEmpty) {
      showMessage(context,
          tr('No friends to add yet. Share the invite code, or add friends first.'));
      return;
    }
    final profiles =
        await ref.read(profilesProvider(profilesKey(friendUids)).future);
    if (!context.mounted) return;
    final picked = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(tr('Add a friend')),
        children: [
          for (final f in friendUids)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(dialogContext, f),
              child: Row(
                children: [
                  Avatar(profile: profiles[f], size: 32),
                  const SizedBox(width: KSpace.md),
                  Expanded(child: Text(profiles[f]?.displayName ?? f)),
                ],
              ),
            ),
        ],
      ),
    );
    if (picked == null || !context.mounted) return;
    try {
      await ref.read(groupsRepositoryProvider).addFriend(group.id, picked);
      if (context.mounted) showMessage(context, tr('Added to the group'));
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

class _Chat extends ConsumerStatefulWidget {
  const _Chat({
    required this.group,
    required this.uid,
    required this.profiles,
    required this.replyTo,
    this.search,
  });

  final Group group;
  final String uid;
  final Map<String, PublicProfile> profiles;
  final String? search;
  final ValueNotifier<GroupMessage?> replyTo;

  @override
  ConsumerState<_Chat> createState() => _ChatState();
}

class _ChatState extends ConsumerState<_Chat> {
  int _limit = 30;
  final _scroll = ScrollController();
  bool _farFromBottom = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final far = _scroll.offset > 600;
      if (far != _farFromBottom) setState(() => _farFromBottom = far);
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final uid = widget.uid;
    final search = widget.search;
    // Searching looks a bit further back (up to 100 messages).
    final limit = search == null || search.trim().isEmpty ? _limit : (_limit < 100 ? 100 : _limit);
    final messages = ref.watch(groupMessagesProvider((group.id, limit)));
    return AsyncView<List<GroupMessage>>(
      value: messages,
      builder: (loaded) {
        final blocked = ref.watch(blockedUsersProvider);
        // Messages from people you blocked are hidden.
        final all = blocked.isEmpty ? loaded : loaded.where((m) => !blocked.containsKey(m.uid)).toList();
        final q = search?.trim().toLowerCase() ?? '';
        final list = q.isEmpty
            ? all
            : all.where((m) => m.text.toLowerCase().contains(q) || m.name.toLowerCase().contains(q)).toList();
        if (q.isNotEmpty && list.isEmpty) {
          return EmptyState(emoji: '🔍', title: tr('No messages match'));
        }
        if (list.isEmpty) {
          return EmptyState(
            emoji: '💬',
            title: tr('Say hi 👋'),
            message: tr('Messages here are seen by everyone in the group.'),
          );
        }
        final listView = ListView.builder(
          controller: _scroll,
          reverse: true, // newest at the bottom, and stays there
          padding: const EdgeInsets.symmetric(
              horizontal: KSpace.md, vertical: KSpace.sm),
          itemCount: list.length + (all.length >= limit ? 1 : 0),
          itemBuilder: (_, i) {
            if (i == list.length) {
              return Center(
                child: TextButton.icon(
                  onPressed: () => setState(() => _limit = limit + 30),
                  icon: const Icon(Icons.history),
                  label: Text(tr('Show older messages')),
                ),
              );
            }
            final m = list[i];
            final older = i + 1 < list.length ? list[i + 1] : null;
            final newDay = m.createdAt != null &&
                (older?.createdAt == null || !sameDay(older!.createdAt!, m.createdAt!));
            final showName = m.uid != uid && (older?.uid != m.uid || newDay);
            final bubble = _Bubble(
                message: m,
                mine: m.uid == uid,
                showName: showName,
                group: group,
                uid: uid,
                onReply: () => widget.replyTo.value = m);
            if (!newDay) return bubble;
            return Column(
              children: [
                _DayDivider(label: chatDayLabel(m.createdAt!, DateTime.now())),
                bubble,
              ],
            );
          },
        );
        return Stack(
          children: [
            listView,
            if (_farFromBottom)
              PositionedDirectional(
                end: KSpace.md,
                bottom: KSpace.md,
                child: FloatingActionButton.small(
                  heroTag: null,
                  tooltip: tr('Newest messages'),
                  onPressed: () => _scroll.animateTo(0,
                      duration: const Duration(milliseconds: 300), curve: Curves.easeOut),
                  child: const Icon(Icons.keyboard_double_arrow_down),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Bubble extends ConsumerWidget {
  const _Bubble({
    required this.message,
    required this.mine,
    required this.showName,
    required this.group,
    required this.uid,
    required this.onReply,
  });

  final GroupMessage message;
  final bool mine;
  final bool showName;
  final Group group;
  final String uid;
  final VoidCallback onReply;
  String get groupId => group.id;

  static const _emojis = ['👍', '❤️', '😂', '😮', '🎉', '👎'];

  Future<void> _actions(BuildContext context, WidgetRef ref) async {
    final mineReaction = message.reactions[uid];
    final picked = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (final e in _emojis)
                  InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => Navigator.pop(sheetContext, e),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: e == mineReaction ? sheetContext.k.accentSoft : null,
                      ),
                      child: Text(e, style: const TextStyle(fontSize: 28)),
                    ),
                  ),
              ],
            ),
            ListTile(
              leading: const Icon(Icons.reply),
              title: Text(tr('Reply')),
              onTap: () => Navigator.pop(sheetContext, 'reply'),
            ),
            ListTile(
              leading: const Icon(Icons.copy),
              title: Text(tr('Copy message')),
              onTap: () => Navigator.pop(sheetContext, 'copy'),
            ),
            if (mine)
              ListTile(
                leading: const Icon(Icons.delete_outline),
                title: Text(tr('Delete my message')),
                onTap: () => Navigator.pop(sheetContext, 'delete'),
              ),
            if (!mine) ...[
              ListTile(
                leading: const Icon(Icons.flag_outlined),
                title: Text(tr('Report message')),
                onTap: () => Navigator.pop(sheetContext, 'report'),
              ),
              ListTile(
                leading: const Icon(Icons.block),
                title: Text(trf('Block {name}', {'name': message.name})),
                onTap: () => Navigator.pop(sheetContext, 'block'),
              ),
            ],
          ],
        ),
      ),
    );
    if (picked == null || !context.mounted) return;
    switch (picked) {
      case 'reply':
        onReply();
        return;
      case 'delete':
        try {
          await ref.read(groupsRepositoryProvider).deleteMessage(groupId, message.id);
        } catch (e) {
          if (context.mounted) showError(context, e);
        }
        return;
      case 'report':
        final reason = await askReportReason(context);
        if (reason == null) return;
        try {
          await ref
              .read(safetyRepositoryProvider)
              .reportMessage(by: uid, group: group, message: message, reason: reason);
          if (context.mounted) showMessage(context, tr('Thanks. We\'ll review it.'));
        } catch (e) {
          if (context.mounted) showError(context, e);
        }
        return;
      case 'block':
        ref.read(blockedUsersProvider.notifier).set(message.uid, message.name);
        showMessage(context, trf('{name} is blocked. Unblock in Profile → Blocked people.', {'name': message.name}));
        return;
    }
    if (picked == 'copy') {
      await Clipboard.setData(ClipboardData(text: message.text));
      if (context.mounted) showMessage(context, tr('Message copied'));
      return;
    }
    try {
      await ref
          .read(groupsRepositoryProvider)
          .react(groupId, message.id, uid, picked == mineReaction ? null : picked);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final counts = <String, int>{};
    for (final r in message.reactions.values) {
      counts[r] = (counts[r] ?? 0) + 1;
    }
    final time = message.createdAt == null
        ? ''
        : DateFormat(ref.watch(phoneSettingsProvider.select((s) => s.clock24)) ? 'HH:mm' : 'h:mm a')
            .format(message.createdAt!);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () => _actions(context, ref),
        child: ConstrainedBox(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.sizeOf(context).width * 0.78),
        child: Container(
          margin: EdgeInsets.only(top: showName ? KSpace.sm : 2),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: mine ? context.k.accent : context.k.surface,
            border: mine ? null : Border.all(color: context.k.line),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showName)
                Text(message.name,
                    style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: context.k.accent)),
              if (message.replyTo != null)
                Container(
                  margin: const EdgeInsets.only(bottom: 4),
                  padding: const EdgeInsetsDirectional.only(start: 8, top: 2, bottom: 2),
                  decoration: BoxDecoration(
                    border: BorderDirectional(
                        start: BorderSide(color: mine ? context.k.onAccent : context.k.accent, width: 3)),
                  ),
                  child: Text('${message.replyName ?? ''}: ${message.replyTo}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 12,
                          color: (mine ? context.k.onAccent : context.k.ink).withValues(alpha: 0.8))),
                ),
              _MessageText(text: message.text, mine: mine),
              for (final (link, _) in splitLinks(message.text).where((p) => p.$2).take(3))
                InkWell(
                  onTap: () {
                    // Our own links open inside the app.
                    final uri = Uri.parse(link);
                    final inApp = uri.host == webHost() ? appRouteFor(uri) : null;
                    inApp != null ? context.push(inApp) : openUri(uri);
                  },
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      Uri.tryParse(link)?.host == webHost() && webHost() != null
                          ? tr('✨ Open in Khroga')
                          : link.contains('google.com/maps')
                              ? tr('🗺️ Open in Maps')
                              : tr('🔗 Open link'),
                      style: TextStyle(
                          fontWeight: FontWeight.w700,
                          decoration: TextDecoration.underline,
                          color: mine ? context.k.onAccent : context.k.accent),
                    ),
                  ),
                ),
              if (counts.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    counts.entries.map((e) => e.value > 1 ? '${e.key}${e.value}' : e.key).join(' '),
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              if (time.isNotEmpty)
                Text(time,
                    style: TextStyle(
                        fontSize: 10,
                        color: mine
                            ? context.k.onAccent.withValues(alpha: 0.75)
                            : context.k.inkMuted)),
            ],
          ),
        ),
        ),
      ),
    );
  }
}

class _DayDivider extends StatelessWidget {
  const _DayDivider({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KSpace.sm),
      child: Row(
        children: [
          Expanded(child: Divider(color: context.k.line)),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KSpace.sm),
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(child: Divider(color: context.k.line)),
        ],
      ),
    );
  }
}

const _quickReplies = [
  '🚗 On my way',
  '⏰ Running 10 min late',
  "📍 I'm here",
  '👍 Sounds good',
  '🙏 Can we change the time?',
];

class _Composer extends ConsumerStatefulWidget {
  const _Composer({required this.group, required this.uid, required this.replyTo});

  final Group group;
  final String uid;
  final ValueNotifier<GroupMessage?> replyTo;

  @override
  ConsumerState<_Composer> createState() => _ComposerState();
}

class _ComposerState extends ConsumerState<_Composer> {
  final _controller = TextEditingController();
  bool _sending = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _sendFavorite() async {
    final favorites = await ref.read(favoritePlacesProvider.future);
    if (!mounted) return;
    if (favorites.isEmpty) {
      showMessage(context, tr('Tap the heart on places to have favorites to send.'));
      return;
    }
    final picked = await showModalBottomSheet<Place>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (_, controller) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(KSpace.md),
          children: [
            Text(tr('Send a favorite place'), style: Theme.of(sheetContext).textTheme.titleLarge),
            for (final p in favorites)
              ListTile(
                leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 22)),
                title: Text(p.name),
                subtitle: p.area == null ? null : Text(p.area!),
                onTap: () => Navigator.pop(sheetContext, p),
              ),
          ],
        ),
      ),
    );
    if (picked != null) await _send(placeChatText(picked) + placeLinkLine(picked.id));
  }

  Future<void> _sendMyLocation() async {
    try {
      final here = await ref.read(locationServiceProvider).current();
      await _send(myLocationText(here.$1, here.$2));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Future<void> _send([String? quick]) async {
    final text = (quick ?? _controller.text).trim();
    if (text.isEmpty || _sending) return;
    if (!await ensureCommunityRules(context, ref)) return;
    if (!mounted) return;
    setState(() => _sending = true);
    final name = ref.read(myProfileProvider).value?.displayName ?? 'Someone';
    try {
      await ref.read(groupsRepositoryProvider).sendMessage(
            groupId: widget.group.id,
            uid: widget.uid,
            name: name,
            text: text,
            updatePreview: shouldUpdatePreview(widget.group.lastMessageAt, DateTime.now()),
            replyTo: widget.replyTo.value,
          );
      widget.replyTo.value = null;
      tapFeedback(ref.read(phoneSettingsProvider).haptics);
      if (quick == null) _controller.clear();
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.xs, KSpace.sm, KSpace.sm),
      decoration: BoxDecoration(
        color: context.k.surface,
        border: Border(top: BorderSide(color: context.k.line)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ValueListenableBuilder<GroupMessage?>(
            valueListenable: widget.replyTo,
            builder: (context, m, _) => m == null
                ? const SizedBox.shrink()
                : Row(
                    children: [
                      const Icon(Icons.reply, size: 18),
                      const SizedBox(width: KSpace.xs),
                      Expanded(
                        child: Text(trf('Replying to {name}: {text}', {'name': m.name, 'text': m.text}),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                      ),
                      IconButton(
                        tooltip: tr('Cancel'),
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () => widget.replyTo.value = null,
                      ),
                    ],
                  ),
          ),
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _quickReplies.length,
              separatorBuilder: (_, _) => const SizedBox(width: KSpace.xs),
              itemBuilder: (_, i) => ActionChip(
                visualDensity: VisualDensity.compact,
                label: Text(tr(_quickReplies[i])),
                onPressed: _sending ? null : () => _send(tr(_quickReplies[i])),
              ),
            ),
          ),
          Row(
        children: [
          IconButton(
            tooltip: tr('Send a favorite place'),
            onPressed: _sending ? null : _sendFavorite,
            icon: const Icon(Icons.place_outlined),
          ),
          IconButton(
            tooltip: tr('Send my location'),
            onPressed: _sending ? null : _sendMyLocation,
            icon: const Icon(Icons.my_location),
          ),
          Expanded(
            child: TextField(
              controller: _controller,
              minLines: 1,
              maxLines: 4,
              maxLength: 1000,
              textCapitalization: TextCapitalization.sentences,
              decoration: InputDecoration(
                hintText: tr('Message'),
                counterText: _controller.text.length > 800 ? '${_controller.text.length}/1000' : '',
                isDense: true,
              ),
              onChanged: (v) {
                if (v.length > 790 || v.isEmpty) setState(() {});
              },
              onSubmitted: (_) => _send(),
            ),
          ),
          const SizedBox(width: KSpace.xs),
          IconButton.filled(
            onPressed: _sending ? null : _send,
            icon: const Icon(Icons.send_rounded),
          ),
        ],
      ),
        ],
      ),
    );
  }
}

/// "In 3 days", "Tomorrow", "In 5 hours", "Today", "Happened".
String countdownText(DateTime when) {
  final diff = when.difference(DateTime.now());
  if (diff.isNegative) return tr(diff.inHours > -6 ? 'Happening now' : 'Already happened');
  final today = DateTime.now();
  final daysAway = DateTime(when.year, when.month, when.day)
      .difference(DateTime(today.year, today.month, today.day))
      .inDays;
  if (daysAway == 0) {
    return diff.inHours >= 1
        ? trf('⏳ In {n} h', {'n': diff.inHours})
        : trf('⏳ In {n} min', {'n': diff.inMinutes});
  }
  if (daysAway == 1) return tr('⏳ Tomorrow');
  return trf('⏳ In {n} days', {'n': daysAway});
}

/// A Google Calendar "add event" link for the group's outing.
Uri calendarLink(Group group) {
  String fmt(DateTime d) {
    final u = d.toUtc();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${u.year}${two(u.month)}${two(u.day)}T${two(u.hour)}${two(u.minute)}00Z';
  }

  final start = group.scheduledAt!;
  final end = start.add(const Duration(hours: 3));
  final stops = group.planStops.map((s) => s['name']).whereType<String>().join(', ');
  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': group.name,
    'dates': '${fmt(start)}/${fmt(end)}',
    'details': [
      if (group.planTitle != null) 'Plan: ${group.planTitle}',
      if (stops.isNotEmpty) 'Stops: $stops',
      'Planned with Khroga',
    ].join('\n'),
  });
}

/// Type the total bill, see what each paying person owes. Nothing is saved
/// and no prices are guessed: the number comes from you.
void _showBillSplitter(BuildContext context, Group group) {
  final paying = group.payingUids.length;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _BillSplitter(
        defaultPeople: paying > 0 ? paying : group.memberUids.length, group: group),
  );
}

class _BillSplitter extends ConsumerStatefulWidget {
  const _BillSplitter({required this.defaultPeople, required this.group});

  final int defaultPeople;
  final Group group;

  @override
  ConsumerState<_BillSplitter> createState() => _BillSplitterState();
}

class _BillSplitterState extends ConsumerState<_BillSplitter> {
  final _total = TextEditingController();
  late int _people = widget.defaultPeople.clamp(1, 50);
  int _tipPercent = 0;
  bool _service = false; // many Egyptian restaurants add 12% service
  bool _vat = false; // and 14% VAT, when it isn't already on the bill

  @override
  void dispose() {
    _total.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final total = double.tryParse(_total.text.replaceAll(',', '').trim()) ?? 0;
    final withTip = billTotal(total, servicePct: _service ? 12 : 0, vatPct: _vat ? 14 : 0, tipPct: _tipPercent);
    final each = _people == 0 ? 0 : withTip / _people;
    return Padding(
      padding: EdgeInsets.fromLTRB(
          KSpace.lg, KSpace.lg, KSpace.lg, KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(tr('Split the bill'), style: text.titleLarge),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _total,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(labelText: tr('Total bill'), suffixText: 'EGP'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: KSpace.md),
          Row(
            children: [
              Expanded(child: Text(tr('People paying'))),
              IconButton.outlined(
                onPressed: _people > 1 ? () => setState(() => _people--) : null,
                icon: const Icon(Icons.remove),
              ),
              SizedBox(width: 40, child: Text('$_people', textAlign: TextAlign.center, style: text.titleLarge)),
              IconButton.outlined(
                onPressed: () => setState(() => _people++),
                icon: const Icon(Icons.add),
              ),
            ],
          ),
          const SizedBox(height: KSpace.sm),
          Wrap(
            spacing: KSpace.sm,
            children: [
              for (final t in [0, 10, 12, 15])
                ChoiceChip(
                  label: Text(t == 0 ? tr('No tip') : '+$t%'),
                  selected: _tipPercent == t,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _tipPercent = t),
                ),
            ],
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Add 12% service')),
            value: _service,
            onChanged: (v) => setState(() => _service = v ?? false),
          ),
          CheckboxListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(tr('Add 14% VAT')),
            subtitle: Text(tr("Only if it isn't already on the bill")),
            value: _vat,
            onChanged: (v) => setState(() => _vat = v ?? false),
          ),
          const SizedBox(height: KSpace.sm),
          Container(
            padding: const EdgeInsets.all(KSpace.md),
            decoration: BoxDecoration(
              color: context.k.accentSoft,
              borderRadius: BorderRadius.circular(KRadius.card),
            ),
            child: Column(
              children: [
                Text(tr('Each person pays'), style: text.bodyMedium),
                Text(trf('{n} EGP', {'n': each.ceil()}), style: text.headlineMedium),
                if (withTip != total)
                  Text(trf('Total with tip: {n} EGP', {'n': withTip.ceil()}), style: text.bodySmall),
              ],
            ),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton.icon(
            onPressed: total <= 0
                ? null
                : () async {
                    final uid = ref.read(uidProvider);
                    if (uid == null) return;
                    try {
                      await ref.read(groupsRepositoryProvider).sendMessage(
                            groupId: widget.group.id,
                            uid: uid,
                            name: ref.read(myProfileProvider).value?.displayName ?? tr('Someone'),
                            text: trf('💸 Bill: {total} EGP · {people} people · {each} EGP each',
                                {'total': withTip.ceil(), 'people': _people, 'each': each.ceil()}),
                          );
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      if (context.mounted) showError(context, e);
                    }
                  },
            icon: const Icon(Icons.send_outlined),
            label: Text(tr('Send to the group chat')),
          ),
        ],
      ),
    );
  }
}

// ---- Polls ----

void _showPolls(BuildContext context, Group group, String uid) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (_) => _PollsSheet(group: group, uid: uid),
  );
}

class _PollsSheet extends ConsumerWidget {
  const _PollsSheet({required this.group, required this.uid});

  final Group group;
  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final polls = ref.watch(groupPollsProvider(group.id));
    final repo = ref.read(groupsRepositoryProvider);
    final names = ref.watch(profilesProvider(profilesKey(group.memberUids))).value ?? const {};
    final text = Theme.of(context).textTheme;
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      builder: (_, controller) => AsyncView<List<Poll>>(
        value: polls,
        builder: (list) => ListView(
          controller: controller,
          padding: const EdgeInsets.all(KSpace.lg),
          children: [
            Row(
              children: [
                Expanded(child: Text(tr('Polls'), style: text.titleLarge)),
                FilledButton.icon(
                  onPressed: () => _newPoll(context, ref),
                  icon: const Icon(Icons.add),
                  label: Text(tr('New poll')),
                ),
              ],
            ),
            if (list.isEmpty)
              Padding(
                padding: EdgeInsets.only(top: KSpace.lg),
                child: Text(tr('No polls yet. Ask "Which place?" or "What time?" and everyone votes.')),
              ),
            for (final p in list)
              Card(
                margin: const EdgeInsets.only(top: KSpace.md),
                child: Padding(
                  padding: const EdgeInsets.all(KSpace.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text(p.question, style: text.titleMedium)),
                          if (p.uid == uid || group.isOwner(uid))
                            IconButton(
                              tooltip: tr('Delete poll'),
                              icon: const Icon(Icons.delete_outline, size: 20),
                              onPressed: () async {
                                try {
                                  await repo.deletePoll(group.id, p.id);
                                } catch (e) {
                                  if (context.mounted) showError(context, e);
                                }
                              },
                            ),
                        ],
                      ),
                      Text(trf('{a} of {b} voted', {'a': p.votes.length, 'b': group.memberUids.length}), style: text.bodySmall),
                      const SizedBox(height: KSpace.sm),
                      for (final (i, option) in p.options.indexed)
                        Padding(
                          padding: const EdgeInsets.only(bottom: KSpace.xs),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () async {
                              try {
                                await repo.vote(group.id, p.id, uid, i);
                              } catch (e) {
                                if (context.mounted) showError(context, e);
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(KSpace.sm),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: p.votes[uid] == i ? context.k.accent : context.k.line,
                                    width: p.votes[uid] == i ? 2 : 1),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(child: Text(option)),
                                      Text('${p.countFor(i)}',
                                          style: const TextStyle(fontWeight: FontWeight.w700)),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(4),
                                    child: LinearProgressIndicator(
                                      value: p.votes.isEmpty ? 0 : p.countFor(i) / p.votes.length,
                                      minHeight: 6,
                                      color: context.k.accent,
                                      backgroundColor: context.k.accentSoft,
                                    ),
                                  ),
                                  if (p.countFor(i) > 0)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        p.votes.entries
                                            .where((e) => e.value == i)
                                            .map((e) => names[e.key]?.displayName ?? '…')
                                            .join('، '),
                                        style: Theme.of(context).textTheme.bodySmall,
                                      ),
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
      ),
    );
  }

  Future<void> _newPoll(BuildContext context, WidgetRef ref) async {
    final question = TextEditingController();
    final options = [TextEditingController(), TextEditingController()];
    // Suggest the plan's stops as options, a quick "which place?" poll.
    final stopNames = group.planStops.map((s) => s['name']).whereType<String>().take(6).toList();
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          title: Text(tr('New poll')),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: question,
                  maxLength: 150,
                  decoration: InputDecoration(hintText: tr('Question, e.g. Which place?')),
                ),
                for (final (i, c) in options.indexed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: KSpace.sm),
                    child: TextField(
                      controller: c,
                      maxLength: 60,
                      decoration: InputDecoration(hintText: trf('Option {n}', {'n': i + 1}), counterText: ''),
                    ),
                  ),
                if (options.length < 6)
                  TextButton.icon(
                    onPressed: () => setState(() => options.add(TextEditingController())),
                    icon: const Icon(Icons.add),
                    label: Text(tr('Add option')),
                  ),
                Wrap(spacing: KSpace.sm, children: [
                  ActionChip(
                    avatar: const Text('📅'),
                    label: Text(tr('Which day?')),
                    onPressed: () => setState(() {
                      question.text = tr('Which day works for you?');
                      for (final c in options) {
                        c.dispose();
                      }
                      final now = DateTime.now();
                      options
                        ..clear()
                        ..addAll(nextDays(now, count: 6).map((d) => TextEditingController(
                            text: d.day == now.day ? tr('Today') : DateFormat('EEE d MMM').format(d))));
                    }),
                  ),
                  ActionChip(
                    avatar: const Text('🕒'),
                    label: Text(tr('What time?')),
                    onPressed: () => setState(() {
                      question.text = tr('What time should we meet?');
                      for (final c in options) {
                        c.dispose();
                      }
                      options
                        ..clear()
                        ..addAll(['12:00', '15:00', '18:00', '20:00', '22:00'].map((t) => TextEditingController(text: t)));
                    }),
                  ),
                  ActionChip(
                    avatar: const Text('✨'),
                    label: Text(tr('What vibe?')),
                    onPressed: () => setState(() {
                      question.text = tr('What are we in the mood for?');
                      for (final c in options) {
                        c.dispose();
                      }
                      options
                        ..clear()
                        ..addAll(['chill', 'foodie', 'active', 'culture', 'shopping', 'nightlife']
                            .map((v) => TextEditingController(text: tr(Vibes.all[v]!))));
                    }),
                  ),
                ]),
                if (stopNames.length >= 2)
                  TextButton.icon(
                    onPressed: () => setState(() {
                      question.text = question.text.isEmpty ? tr('Which place?') : question.text;
                      for (final c in options) {
                        c.dispose();
                      }
                      options
                        ..clear()
                        ..addAll(stopNames.map((n) => TextEditingController(text: n)));
                    }),
                    icon: const Icon(Icons.map_outlined),
                    label: Text(tr("Use the plan's stops")),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(tr('Cancel'))),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text(tr('Ask'))),
          ],
        ),
      ),
    );
    final q = question.text.trim();
    final opts = options.map((c) => c.text.trim()).where((t) => t.isNotEmpty).toList();
    question.dispose();
    for (final c in options) {
      c.dispose();
    }
    if (ok != true) return;
    if (q.isEmpty || opts.length < 2) {
      if (context.mounted) showMessage(context, tr('Add a question and at least 2 options.'));
      return;
    }
    try {
      await ref.read(groupsRepositoryProvider).createPoll(group.id, uid, q, opts);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

/// Message text: big when it's only emoji, @mentions in bold, and long
/// messages folded with "Read more".
class _MessageText extends StatefulWidget {
  const _MessageText({required this.text, required this.mine});

  final String text;
  final bool mine;

  @override
  State<_MessageText> createState() => _MessageTextState();
}

class _MessageTextState extends State<_MessageText> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final color = widget.mine ? context.k.onAccent : context.k.ink;
    if (isOnlyEmoji(widget.text)) {
      return Text(widget.text, style: const TextStyle(fontSize: 36));
    }
    final long = widget.text.length > 400;
    final shown = long && !_open ? '${widget.text.substring(0, 400)}…' : widget.text;
    final spans = <TextSpan>[
      for (final part in shown.split(RegExp(r'(?=@)|(?<=@\S+)(?=\s)')))
        TextSpan(
          text: part,
          style: part.startsWith('@') ? const TextStyle(fontWeight: FontWeight.w800) : null,
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(TextSpan(children: spans), style: TextStyle(color: color, fontSize: 15)),
        if (long)
          GestureDetector(
            onTap: () => setState(() => _open = !_open),
            child: Text(_open ? tr('Show less') : tr('Read more'),
                style: TextStyle(color: color, fontWeight: FontWeight.w700, decoration: TextDecoration.underline)),
          ),
      ],
    );
  }
}

/// Asks why something is being reported. Returns the reason, or null.
Future<String?> askReportReason(BuildContext context) => showDialog<String>(
      context: context,
      builder: (d) => SimpleDialog(
        title: Text(tr('Why are you reporting this?')),
        children: [
          for (final r in const ['Rude or bullying', 'Spam', 'Hate or threats', 'Sexual content', 'Something else'])
            SimpleDialogOption(onPressed: () => Navigator.pop(d, r), child: Text(tr(r))),
        ],
      ),
    );

/// Under the outing date: how long until it, the real forecast (when it's
/// within the next week), sunset, and a fixed public holiday.
class _OutingDay extends ConsumerWidget {
  const _OutingDay({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final when = group.scheduledAt!;
    final now = DateTime.now();
    final city = ref.watch(cityProvider);
    final day = DateTime(when.year, when.month, when.day);
    final forecast = (ref.watch(weekForecastProvider(city)).value ?? const <DayForecast>[])
        .where((d) => sameDay(d.day, day))
        .firstOrNull;
    final first = group.planStops.firstOrNull;
    final lat = (first?['lat'] as num?)?.toDouble() ?? cityCenters[city]?.$1;
    final lng = (first?['lng'] as num?)?.toDouble() ?? cityCenters[city]?.$2;
    final sun = lat == null || lng == null ? null : sunTimes(day, lat, lng);
    final holiday = egyptHoliday(day);
    final parts = [
      ?daysUntilText(day, now),
      if (forecast != null) trf('{t}° · {r}% rain', {'t': forecast.maxC.round(), 'r': forecast.rainPct}),
      if (sun != null) trf('🌇 Sunset at {time}', {'time': hhmmLocal(sun.sunset)}),
      ?holiday,
    ];
    if (parts.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 28, top: 2),
      child: Text(parts.join(' · '),
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted)),
    );
  }
}
