import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import 'create_group_sheet.dart';

class GroupsScreen extends ConsumerWidget {
  const GroupsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final groups = ref.watch(myGroupsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Groups'),
        actions: [
          TextButton.icon(
            onPressed: () => _showJoinSheet(context),
            icon: const Icon(Icons.login),
            label: const Text('Join'),
          ),
          const SizedBox(width: KSpace.sm),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => showCreateGroupSheet(context),
        icon: const Icon(Icons.add),
        label: const Text('New group'),
      ),
      body: AsyncView<List<Group>>(
        value: groups,
        builder: (list) => list.isEmpty
            ? EmptyState(
                emoji: '👯',
                title: 'No groups yet',
                message: 'Make a group for your next outing, or join one with '
                    'a code from a friend.',
                actionLabel: 'Join with a code',
                onAction: () => _showJoinSheet(context),
              )
            : ListView.separated(
                padding: const EdgeInsets.fromLTRB(
                    KSpace.md, 0, KSpace.md, 100),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
                itemBuilder: (_, i) => _GroupTile(group: list[i]),
              ),
      ),
    );
  }
}

class _GroupTile extends StatelessWidget {
  const _GroupTile({required this.group});

  final Group group;

  @override
  Widget build(BuildContext context) {
    final going = group.rsvp.values.where((r) => r == Rsvp.going).length;
    final sub = [
      if (group.scheduledAt != null)
        DateFormat('EEE d MMM, h:mm a').format(group.scheduledAt!),
      '${group.memberUids.length} members',
      if (going > 0) '$going going',
    ].join(' · ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.xs),
        leading: CircleAvatar(
          backgroundColor: KColors.accentSoft,
          child: Text(
            group.name.isEmpty ? '?' : group.name.characters.first.toUpperCase(),
            style: const TextStyle(
                color: KColors.accent, fontWeight: FontWeight.w700),
          ),
        ),
        title: Text(group.name,
            style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          group.lastMessage ?? sub,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/group/${group.id}'),
      ),
    );
  }
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
      throw Exception('Enter the code your friend shared.');
    }
    final router = GoRouter.of(context);
    final id = await ref.read(groupsRepositoryProvider).join(_code.text);
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
          Text('Join a group', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _code,
            autofocus: true,
            textCapitalization: TextCapitalization.characters,
            autocorrect: false,
            style: const TextStyle(
                fontSize: 22, letterSpacing: 4, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
            decoration: const InputDecoration(hintText: 'CODE'),
          ),
          const SizedBox(height: KSpace.md),
          BusyButton(label: 'Join', onPressed: _join),
        ],
      ),
    );
  }
}
