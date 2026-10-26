import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';
import 'create_group_sheet.dart';
import 'group_detail_screen.dart' show countdownText;

class GroupsScreen extends ConsumerStatefulWidget {
  const GroupsScreen({super.key});

  @override
  ConsumerState<GroupsScreen> createState() => _GroupsScreenState();
}

class _GroupsScreenState extends ConsumerState<GroupsScreen> {
  String _q = '';
  String _sort = 'recent'; // recent, name, date

  @override
  Widget build(BuildContext context) {
    final groups = ref.watch(myGroupsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Groups')),
        actions: [
          PopupMenuButton<String>(
            tooltip: tr('More'),
            onSelected: (v) {
              if (v == 'read') {
                final opened = ref.read(groupOpenedProvider.notifier);
                for (final g in ref.read(myGroupsProvider).value ?? const <Group>[]) {
                  opened.set(g.id, DateTime.now().toIso8601String());
                }
                showMessage(context, tr('All marked as read'));
              } else {
                setState(() => _sort = v);
              }
            },
            itemBuilder: (_) => [
              CheckedPopupMenuItem(value: 'recent', checked: _sort == 'recent', child: Text(tr('Newest messages first'))),
              CheckedPopupMenuItem(value: 'date', checked: _sort == 'date', child: Text(tr('Next outing first'))),
              CheckedPopupMenuItem(value: 'name', checked: _sort == 'name', child: Text(tr('By name'))),
              const PopupMenuDivider(),
              PopupMenuItem(value: 'read', child: Text(tr('Mark all as read'))),
            ],
          ),
          IconButton(
            tooltip: tr('Scan an invite QR code'),
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/scan'),
          ),
          TextButton.icon(
            onPressed: () => _showJoinSheet(context),
            icon: const Icon(Icons.login),
            label: Text(tr('Join')),
          ),
          const SizedBox(width: KSpace.sm),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showCreateGroupSheet(context),
        icon: const Icon(Icons.add),
        label: Text(tr('New group')),
      ),
      body: AsyncView<List<Group>>(
        value: groups,
        builder: (list) => list.isEmpty
            ? EmptyState(
                emoji: '👯',
                title: tr('No groups yet'),
                message: tr('Make a group for your next outing, or join one with '
                    'a code from a friend.'),
                actionLabel: tr('Join with a code'),
                onAction: () => _showJoinSheet(context),
              )
            : Builder(builder: (context) {
                final shown = list
                    .where((g) => g.name.toLowerCase().contains(_q.toLowerCase()))
                    .toList();
                if (_sort == 'name') {
                  shown.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
                } else if (_sort == 'date') {
                  final far = DateTime(9999);
                  final now = DateTime.now().subtract(const Duration(hours: 6));
                  DateTime key(Group g) =>
                      g.scheduledAt != null && g.scheduledAt!.isAfter(now) ? g.scheduledAt! : far;
                  shown.sort((a, b) => key(a).compareTo(key(b)));
                }
                // Your pinned groups (on this phone) stay on top.
                final pins = ref.watch(pinnedGroupsProvider);
                final pinned = [for (final g in shown) if (pins.containsKey(g.id)) g];
                shown
                  ..removeWhere((g) => pins.containsKey(g.id))
                  ..insertAll(0, pinned);
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, 100),
                  itemCount: shown.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
                  itemBuilder: (_, i) => i == 0
                      ? TextField(
                          decoration: InputDecoration(
                              hintText: tr('Search your groups'), prefixIcon: Icon(Icons.search)),
                          onChanged: (v) => setState(() => _q = v),
                        )
                      : _GroupTile(group: shown[i - 1]),
                );
              }),
      ),
    );
  }
}

class _GroupTile extends ConsumerWidget {
  const _GroupTile({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final opened = DateTime.tryParse(ref.watch(groupOpenedProvider)[group.id] ?? '');
    final muted = ref.watch(mutedGroupsProvider).containsKey(group.id);
    final pinned = ref.watch(pinnedGroupsProvider).containsKey(group.id);
    final emoji = ref.watch(groupEmojiProvider)[group.id];
    final unread = !muted &&
        group.lastMessage != null &&
        group.lastMessageAt != null &&
        (opened == null || group.lastMessageAt!.isAfter(opened));
    final going = group.rsvp.values.where((r) => r == Rsvp.going).length;
    final sub = [
      if (group.scheduledAt != null)
        '${countdownText(group.scheduledAt!)} · ${DateFormat('EEE d MMM, h:mm a').format(group.scheduledAt!)}',
      trf('{n} members', {'n': group.memberUids.length}),
      if (going > 0) trf('{n} going', {'n': going}),
    ].join(' · ');
    return Pressable(child: Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.xs),
        leading: CircleAvatar(
          backgroundColor: context.k.accentSoft,
          child: Text(
            emoji ?? (group.name.isEmpty ? '?' : group.name.characters.first.toUpperCase()),
            style: emoji != null
                ? const TextStyle(fontSize: 20)
                : TextStyle(color: context.k.accent, fontWeight: FontWeight.w700),
          ),
        ),
        title: Row(children: [
          Flexible(
            child: Text(group.name,
                maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          if (pinned)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 4),
              child: Icon(Icons.push_pin, size: 15, color: context.k.signal),
            ),
          if (muted)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 4),
              child: Icon(Icons.notifications_off_outlined, size: 15, color: context.k.inkMuted),
            ),
        ]),
        subtitleTextStyle: unread
            ? Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)
            : null,
        subtitle: Text(
          group.lastMessage ?? sub,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: unread
            ? Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(color: context.k.accent, shape: BoxShape.circle),
              )
            : const Icon(Icons.chevron_right),
        onTap: () => context.push('/group/${group.id}'),
        onLongPress: () => _groupMenu(context, ref, group),
      ),
    ));
  }
}

/// Pin, mute or give a group your own emoji. All on this phone only.
Future<void> _groupMenu(BuildContext context, WidgetRef ref, Group group) async {
  final muted = ref.read(mutedGroupsProvider).containsKey(group.id);
  final pinned = ref.read(pinnedGroupsProvider).containsKey(group.id);
  const emojis = ['🎉', '☕', '🍔', '🏖️', '🎬', '⚽', '💼', '👨‍👩‍👧', '❤️', '🎮', '🌙', '🧳'];
  await showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (sheet) => Padding(
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.lg),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(group.name, style: Theme.of(sheet).textTheme.titleLarge),
        const SizedBox(height: KSpace.sm),
        MenuGroup(children: [
          ListTile(
            leading: Icon(pinned ? Icons.push_pin : Icons.push_pin_outlined),
            title: Text(pinned ? tr('Unpin') : tr('Pin to the top')),
            onTap: () {
              ref.read(pinnedGroupsProvider.notifier).set(group.id, pinned ? null : '1');
              Navigator.pop(sheet);
            },
          ),
          ListTile(
            leading: Icon(muted ? Icons.notifications_active_outlined : Icons.notifications_off_outlined),
            title: Text(muted ? tr('Unmute') : tr('Mute (no new-message dot)')),
            onTap: () {
              ref.read(mutedGroupsProvider.notifier).set(group.id, muted ? null : '1');
              Navigator.pop(sheet);
            },
          ),
        ]),
        const SizedBox(height: KSpace.md),
        Text(tr('Your emoji for this group (only you see it)'), style: Theme.of(sheet).textTheme.bodySmall),
        const SizedBox(height: KSpace.xs),
        Wrap(spacing: KSpace.xs, runSpacing: KSpace.xs, children: [
          for (final e in emojis)
            ActionChip(
              label: Text(e, style: const TextStyle(fontSize: 20)),
              onPressed: () {
                ref.read(groupEmojiProvider.notifier).set(group.id, e);
                Navigator.pop(sheet);
              },
            ),
          if (ref.read(groupEmojiProvider).containsKey(group.id))
            ActionChip(
              label: Text(tr('No emoji')),
              onPressed: () {
                ref.read(groupEmojiProvider.notifier).set(group.id, null);
                Navigator.pop(sheet);
              },
            ),
        ]),
      ]),
    ),
  );
}

void _showJoinSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => const _JoinSheet(),
  );
}

class _JoinSheet extends ConsumerStatefulWidget {
  const _JoinSheet();

  @override
  ConsumerState<_JoinSheet> createState() => _JoinSheetState();
}

class _JoinSheetState extends ConsumerState<_JoinSheet> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _join() async {
    if (_code.text.trim().length < 4) {
      throw Exception(tr('Enter the code your friend shared.'));
    }
    final router = GoRouter.of(context);
    final uid = ref.read(uidProvider);
    if (uid == null) throw Exception(tr('Please sign in again.'));
    final id = await ref.read(groupsRepositoryProvider).join(uid, _code.text);
    if (!mounted) return;
    Navigator.of(context).pop();
    router.push('/group/$id');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(KSpace.lg, KSpace.lg, KSpace.lg,
          KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(tr('Join a group'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _code,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            style: const TextStyle(
                fontSize: 22, letterSpacing: 4, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
            decoration: InputDecoration(hintText: tr('CODE')),
          ),
          const SizedBox(height: KSpace.md),
          BusyButton(label: tr('Join'), onPressed: _join),
        ],
      ),
    );
  }
}
