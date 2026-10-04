import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../models/social.dart';
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
          title: "Can't open this group",
          message: friendlyError(e),
        ),
      ),
      data: (g) {
        if (g == null || uid == null || !g.memberUids.contains(uid)) {
          return Scaffold(
            appBar: AppBar(),
            body: const EmptyState(
              emoji: '👋',
              title: "You're not in this group",
              message: 'It may have been deleted, or you left it.',
            ),
          );
        }
        return _GroupView(group: g, uid: uid);
      },
    );
  }
}

class _GroupView extends ConsumerWidget {
  const _GroupView({required this.group, required this.uid});

  final Group group;
  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final profiles =
        ref.watch(profilesProvider(profilesKey(group.memberUids))).value ??
            const {};
    return Scaffold(
      appBar: AppBar(
        title: Text(group.name, overflow: TextOverflow.ellipsis),
        actions: [
          IconButton(
            tooltip: 'Members',
            icon: const Icon(Icons.people_outline),
            onPressed: () => _showMembers(context, group, uid),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // While typing, hide the header so the chat keeps its space.
            if (!keyboardOpen) _Header(group: group, uid: uid),
            Expanded(child: _Chat(group: group, uid: uid, profiles: profiles)),
            _Composer(group: group, uid: uid),
          ],
        ),
      ),
    );
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
                          ? 'No date yet'
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
                      child: Text(group.scheduledAt == null ? 'Set' : 'Change'),
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
              const SizedBox(height: KSpace.sm),
              Row(
                children: [
                  Expanded(
                    child: SegmentedButton<Rsvp>(
                      showSelectedIcon: false,
                      emptySelectionAllowed: true,
                      segments: [
                        for (final r in Rsvp.values)
                          ButtonSegment(value: r, label: Text(r.label)),
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
                children: [
                  if (group.scheduledAt != null)
                    ActionChip(
                      avatar: const Icon(Icons.event_available, size: 18),
                      label: const Text('Add to calendar'),
                      onPressed: () => openUri(calendarLink(group)),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.calculate_outlined, size: 18),
                    label: const Text('Split the bill'),
                    onPressed: () => _showBillSplitter(context, group),
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
          Text('Members', style: text.titleLarge),
          const SizedBox(height: KSpace.md),
          // Join code
          Card(
            child: ListTile(
              title: const Text('Invite code'),
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
                    tooltip: 'Copy',
                    icon: const Icon(Icons.copy),
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: group.joinCode));
                      showMessage(context, 'Code copied');
                    },
                  ),
                  IconButton(
                    tooltip: 'Share',
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
                      const Text('Friends scan this from Friends → Scan'),
                    ],
                  ),
                ),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(dialogContext), child: const Text('Done')),
                ],
              ),
            ),
            icon: const Icon(Icons.qr_code),
            label: const Text('Show invite QR code'),
          ),
          const SizedBox(height: KSpace.sm),
          OutlinedButton.icon(
            onPressed: () => _inviteFriend(context, ref, group),
            icon: const Icon(Icons.person_add_alt),
            label: const Text('Add a friend'),
          ),
          const SectionTitle('Who pays'),
          Text(
            paying == 0
                ? 'Nobody has said "Going" yet.'
                : '$paying ${paying == 1 ? 'person splits' : 'people split'} the bill.'
                    '${isOwner ? ' Tap "Free" for anyone who doesn\'t pay.' : ''}',
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
                  ? FilterChip(
                      label: const Text('Free'),
                      showCheckmark: false,
                      selected: group.freeUids.contains(memberUid),
                      onSelected: (on) async {
                        try {
                          await repo.setFree(group.id, memberUid, on);
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                    )
                  : null,
            ),
          const SizedBox(height: KSpace.lg),
          TextButton(
            style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => _leaveOrDelete(context, ref, group, isOwner),
            child: Text(isOwner ? 'Delete group' : 'Leave group'),
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
        title: Text(isOwner ? 'Delete this group?' : 'Leave this group?'),
        content: Text(isOwner
            ? 'The group and all its messages will be deleted for everyone.'
            : "You'll need a new invite code to come back."),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(isOwner ? 'Delete' : 'Leave')),
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
          'No friends to add yet. Share the invite code, or add friends first.');
      return;
    }
    final profiles =
        await ref.read(profilesProvider(profilesKey(friendUids)).future);
    if (!context.mounted) return;
    final picked = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: const Text('Add a friend'),
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
      if (context.mounted) showMessage(context, 'Added to the group');
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

class _Chat extends ConsumerWidget {
  const _Chat({required this.group, required this.uid, required this.profiles});

  final Group group;
  final String uid;
  final Map<String, PublicProfile> profiles;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final messages = ref.watch(groupMessagesProvider(group.id));
    return AsyncView<List<GroupMessage>>(
      value: messages,
      builder: (list) {
        if (list.isEmpty) {
          return const EmptyState(
            emoji: '💬',
            title: 'Say hi 👋',
            message: 'Messages here are seen by everyone in the group.',
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
            final bubble = _Bubble(message: m, mine: m.uid == uid, showName: showName);
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

class _Bubble extends StatelessWidget {
  const _Bubble({required this.message, required this.mine, required this.showName});

  final GroupMessage message;
  final bool mine;
  final bool showName;

  @override
  Widget build(BuildContext context) {
    final time = message.createdAt == null
        ? ''
        : DateFormat.jm().format(message.createdAt!);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: GestureDetector(
        onLongPress: () {
          Clipboard.setData(ClipboardData(text: message.text));
          showMessage(context, 'Message copied');
        },
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
                label: Text(_quickReplies[i]),
                onPressed: _sending ? null : () => _send(_quickReplies[i]),
              ),
            ),
          ),
          Row(
        children: [
          IconButton(
            tooltip: 'Send my location',
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
              decoration: const InputDecoration(
                hintText: 'Message',
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
  if (diff.isNegative) return diff.inHours > -6 ? 'Happening now' : 'Already happened';
  final today = DateTime.now();
  final daysAway = DateTime(when.year, when.month, when.day)
      .difference(DateTime(today.year, today.month, today.day))
      .inDays;
  if (daysAway == 0) return diff.inHours >= 1 ? '⏳ In ${diff.inHours} h' : '⏳ In ${diff.inMinutes} min';
  if (daysAway == 1) return '⏳ Tomorrow';
  return '⏳ In $daysAway days';
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
          Text('Split the bill', style: text.titleLarge),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _total,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Total bill', suffixText: 'EGP'),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: KSpace.md),
          Row(
            children: [
              const Expanded(child: Text('People paying')),
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
                  label: Text(t == 0 ? 'No tip' : '+$t%'),
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
                Text('Each person pays', style: text.bodyMedium),
                Text('${each.ceil()} EGP', style: text.headlineMedium),
                if (_tipPercent > 0)
                  Text('Total with tip: ${withTip.ceil()} EGP', style: text.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
