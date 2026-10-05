import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../models/social.dart';
import '../../planner/planner.dart' show routeMapsUrl;
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import '../friends/friends_screen.dart' show groupQrPrefix;
import 'create_group_sheet.dart';

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
            if (!keyboardOpen && _search == null) _Header(group: group, uid: uid),
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
            Expanded(child: _Chat(group: group, uid: uid, profiles: profiles, search: _search)),
            if (_search == null) _Composer(group: group, uid: uid),
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
                            '${group.planTitle} · ${group.planStops.length} stops',
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
                  if (routeMapsUrl([for (final s in group.planStops) PlanStop.fromMap(s)]) case final url?)
                    ActionChip(
                      avatar: const Icon(Icons.route_outlined, size: 18),
                      label: Text(tr('Route')),
                      onPressed: () => openUri(url),
                    ),
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
                            text: '👋 Still waiting to hear from ${names.join(', ')}. '
                                "Are you coming? Tap Going / Maybe / Can't at the top.",
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
                            text: '⏰ Reminder: ${group.name} is '
                                '${countdownText(group.scheduledAt!).replaceFirst('⏳ ', '').toLowerCase()} '
                                '(${DateFormat('EEE d MMM, h:mm a').format(group.scheduledAt!)}). '
                                'Tap Going / Maybe / Can\'t above!',
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
                      text: 'Join "${group.name}" on Khroga with code '
                          '${group.joinCode}',
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
                title: Text('Join "${group.name}"', textAlign: TextAlign.center),
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

class _Chat extends ConsumerWidget {
  const _Chat({required this.group, required this.uid, required this.profiles, this.search});

  final Group group;
  final String uid;
  final Map<String, PublicProfile> profiles;
  final String? search;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(groupMessagesProvider(group.id));
    return AsyncView<List<GroupMessage>>(
      value: messages,
      builder: (all) {
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
        return ListView.builder(
          reverse: true, // newest at the bottom, and stays there
          padding: const EdgeInsets.symmetric(
              horizontal: KSpace.md, vertical: KSpace.sm),
          itemCount: list.length,
          itemBuilder: (_, i) {
            final m = list[i];
            final older = i + 1 < list.length ? list[i + 1] : null;
            final newDay = m.createdAt != null &&
                (older?.createdAt == null || !sameDay(older!.createdAt!, m.createdAt!));
            final showName = m.uid != uid && (older?.uid != m.uid || newDay);
            final bubble = _Bubble(
                message: m, mine: m.uid == uid, showName: showName, groupId: group.id, uid: uid);
            if (!newDay) return bubble;
            return Column(
              children: [
                _DayDivider(label: chatDayLabel(m.createdAt!, DateTime.now())),
                bubble,
              ],
            );
          },
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
    required this.groupId,
    required this.uid,
  });

  final GroupMessage message;
  final bool mine;
  final bool showName;
  final String groupId;
  final String uid;

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
              leading: const Icon(Icons.copy),
              title: Text(tr('Copy message')),
              onTap: () => Navigator.pop(sheetContext, 'copy'),
            ),
          ],
        ),
      ),
    );
    if (picked == null) return;
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
        : DateFormat.jm().format(message.createdAt!);
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
              Text(message.text,
                  style: TextStyle(
                      color: mine ? context.k.onAccent : context.k.ink, fontSize: 15)),
              for (final (link, _) in splitLinks(message.text).where((p) => p.$2).take(3))
                InkWell(
                  onTap: () => openUri(Uri.parse(link)),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      link.contains('google.com/maps') ? '🗺️ Open in Maps' : '🔗 Open link',
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
  const _Composer({required this.group, required this.uid});

  final Group group;
  final String uid;

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
    if (picked != null) await _send(placeChatText(picked));
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
    setState(() => _sending = true);
    final name = ref.read(myProfileProvider).value?.displayName ?? 'Someone';
    try {
      await ref.read(groupsRepositoryProvider).sendMessage(
            groupId: widget.group.id,
            uid: widget.uid,
            name: name,
            text: text,
          );
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
                counterText: '',
                isDense: true,
              ),
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
    builder: (_) => _BillSplitter(defaultPeople: paying > 0 ? paying : group.memberUids.length),
  );
}

class _BillSplitter extends StatefulWidget {
  const _BillSplitter({required this.defaultPeople});

  final int defaultPeople;

  @override
  State<_BillSplitter> createState() => _BillSplitterState();
}

class _BillSplitterState extends State<_BillSplitter> {
  final _total = TextEditingController();
  late int _people = widget.defaultPeople.clamp(1, 50);
  int _tipPercent = 0;

  @override
  void dispose() {
    _total.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final total = double.tryParse(_total.text.replaceAll(',', '').trim()) ?? 0;
    final withTip = total * (1 + _tipPercent / 100);
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
          const SizedBox(height: KSpace.lg),
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
                if (_tipPercent > 0)
                  Text(trf('Total with tip: {n} EGP', {'n': withTip.ceil()}), style: text.bodySmall),
              ],
            ),
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
                              child: Row(
                                children: [
                                  Expanded(child: Text(option)),
                                  Text('${p.countFor(i)}',
                                      style: const TextStyle(fontWeight: FontWeight.w700)),
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
