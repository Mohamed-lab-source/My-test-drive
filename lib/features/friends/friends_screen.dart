import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../auth/username_sheet.dart';

/// QR codes encode this prefix + uid, so we never act on random QR codes.
const qrPrefix = 'khroga:user:';

class FriendsScreen extends ConsumerWidget {
  const FriendsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uid = ref.watch(uidProvider);
    final me = ref.watch(myProfileProvider).value;
    final isGuest = ref.watch(authStateProvider).value?.isAnonymous ?? true;
    final friendships = ref.watch(friendshipsProvider);

    if (isGuest) {
      return Scaffold(
        appBar: AppBar(title: const Text('Friends')),
        body: EmptyState(
          emoji: '🤝',
          title: 'Sign in to add friends',
          message: 'Guests can plan and join groups. To add friends, sign in '
              'with Google — your plans and groups come with you.',
          actionLabel: 'Sign in with Google',
          onAction: () async {
            try {
              await ref.read(authRepositoryProvider).signInWithGoogle();
            } catch (e) {
              if (context.mounted) showError(context, e);
            }
          },
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Friends'),
        actions: [
          if (me?.username != null)
            IconButton(
              tooltip: 'My QR code',
              icon: const Icon(Icons.qr_code),
              onPressed: () => _showMyQr(context, uid!, me!),
            ),
          IconButton(
            tooltip: 'Scan a QR code',
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => context.push('/scan'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          if (me != null && me.username == null)
            Card(
              child: ListTile(
                leading: const Text('🏷️', style: TextStyle(fontSize: 26)),
                title: const Text('Pick a username'),
                subtitle: const Text('So friends can find you'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => showUsernameSheet(context),
              ),
            ),
          const SizedBox(height: KSpace.sm),
          const _SearchBox(),
          AsyncView<List<Friendship>>(
            value: friendships,
            builder: (list) => _FriendLists(uid: uid!, friendships: list),
          ),
        ],
      ),
    );
  }

  void _showMyQr(BuildContext context, String uid, PublicProfile me) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('@${me.username}', textAlign: TextAlign.center),
        content: SizedBox(
          width: 240,
          height: 240,
          child: QrImageView(data: '$qrPrefix$uid', size: 240),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context), child: const Text('Done')),
        ],
      ),
    );
  }
}

class _SearchBox extends ConsumerStatefulWidget {
  const _SearchBox();

  @override
  ConsumerState<_SearchBox> createState() => _SearchBoxState();
}

class _SearchBoxState extends ConsumerState<_SearchBox> {
  Timer? _debounce;
  String _query = '';
  List<PublicProfile> _results = const [];
  bool _loading = false;

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(value));
  }

  Future<void> _search(String value) async {
    setState(() {
      _query = value;
      _loading = true;
    });
    try {
      final results =
          await ref.read(socialRepositoryProvider).searchUsername(value);
      if (mounted && value == _query) setState(() => _results = results);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = ref.watch(uidProvider);
    final friendships = ref.watch(friendshipsProvider).value ?? const [];
    final known = {for (final f in friendships) f.otherUid(uid ?? ''): f};
    final visible = _results.where((p) => p.uid != uid).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          decoration: InputDecoration(
            hintText: 'Find friends by @username',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _loading
                ? const Padding(
                    padding: EdgeInsets.all(14),
                    child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2)),
                  )
                : null,
          ),
          autocorrect: false,
          onChanged: _onChanged,
        ),
        if (_query.trim().length >= 2 && !_loading && visible.isEmpty)
          const Padding(
            padding: EdgeInsets.all(KSpace.md),
            child: Text('No one with that username.',
                style: TextStyle(color: KColors.inkMuted)),
          ),
        for (final p in visible)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Avatar(profile: p),
            title: Text(p.displayName),
            subtitle: Text('@${p.username}'),
            trailing: known.containsKey(p.uid)
                ? Text(
                    known[p.uid]!.status == FriendshipStatus.accepted
                        ? 'Friends'
                        : 'Requested',
                    style: const TextStyle(color: KColors.inkMuted))
                : FilledButton.tonal(
                    onPressed: () async {
                      try {
                        await ref
                            .read(socialRepositoryProvider)
                            .sendRequest(uid!, p.uid);
                        if (context.mounted) showMessage(context, 'Request sent');
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: const Text('Add'),
                  ),
          ),
      ],
    );
  }
}

class _FriendLists extends ConsumerWidget {
  const _FriendLists({required this.uid, required this.friendships});

  final String uid;
  final List<Friendship> friendships;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incoming = friendships
        .where((f) =>
            f.status == FriendshipStatus.pending && f.requestedBy != uid)
        .toList();
    final outgoing = friendships
        .where((f) =>
            f.status == FriendshipStatus.pending && f.requestedBy == uid)
        .toList();
    final friends =
        friendships.where((f) => f.status == FriendshipStatus.accepted).toList();
    final profiles = ref
            .watch(profilesProvider(
                profilesKey(friendships.map((f) => f.otherUid(uid)))))
            .value ??
        const {};
    final repo = ref.read(socialRepositoryProvider);

    Future<void> guard(BuildContext context, Future<void> Function() f) async {
      try {
        await f();
      } catch (e) {
        if (context.mounted) showError(context, e);
      }
    }

    Widget tile(Friendship f, {Widget? trailing}) {
      final p = profiles[f.otherUid(uid)];
      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: Avatar(profile: p),
        title: Text(p?.displayName ?? '…'),
        subtitle: p?.username == null ? null : Text('@${p!.username}'),
        trailing: trailing,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (incoming.isNotEmpty) ...[
          const SectionTitle('Requests'),
          for (final f in incoming)
            tile(f,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Decline',
                      icon: const Icon(Icons.close),
                      onPressed: () => guard(context, () => repo.remove(f.id)),
                    ),
                    FilledButton(
                      onPressed: () => guard(context, () => repo.accept(f.id)),
                      child: const Text('Accept'),
                    ),
                  ],
                )),
        ],
        SectionTitle('Friends (${friends.length})'),
        if (friends.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: KSpace.md),
            child: Text(
              'Search for friends above, or scan their QR code.',
              style: TextStyle(color: KColors.inkMuted),
            ),
          ),
        for (final f in friends)
          tile(f,
              trailing: PopupMenuButton<String>(
                onSelected: (_) => guard(context, () => repo.remove(f.id)),
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'remove', child: Text('Remove friend')),
                ],
              )),
        if (outgoing.isNotEmpty) ...[
          const SectionTitle('Sent requests'),
          for (final f in outgoing)
            tile(f,
                trailing: TextButton(
                  onPressed: () => guard(context, () => repo.remove(f.id)),
                  child: const Text('Cancel'),
                )),
        ],
      ],
    );
  }
}
