import '../../app/i18n.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/social.dart';
import '../../app/helpers.dart' show timeAgo;
import '../../data/checkins_repository.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../auth/username_sheet.dart';

/// QR codes encode this prefix + uid, so we never act on random QR codes.
const qrPrefix = 'khroga:user:';

/// Group invite QR codes: this prefix + the group's invite code.
const groupQrPrefix = 'khroga:group:';

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
        appBar: AppBar(title: Text(tr('Friends'))),
        body: EmptyState(
          emoji: '🤝',
          title: tr('Sign in to add friends'),
          message: tr('Guests can plan and join groups. To add friends, sign in '
              'with Google — your plans and groups come with you.'),
          actionLabel: tr('Sign in with Google'),
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
        title: Text(tr('Friends')),
        actions: [
          if (me?.username != null)
            IconButton(
              tooltip: tr('Copy my username'),
              icon: const Icon(Icons.copy),
              onPressed: () {
                Clipboard.setData(ClipboardData(text: '@${me!.username}'));
                showMessage(context, tr('Username copied'));
              },
            ),
          if (me?.username != null)
            IconButton(
              tooltip: tr('Share my username'),
              icon: const Icon(Icons.share_outlined),
              onPressed: () => SharePlus.instance.share(ShareParams(
                  text: 'Add me on Khroga: @${me!.username}\n'
                      'Open Friends, search "${me.username}" and tap Add.')),
            ),
          if (me?.username != null)
            IconButton(
              tooltip: tr('My QR code'),
              icon: const Icon(Icons.qr_code),
              onPressed: () => _showMyQr(context, uid!, me!),
            ),
          IconButton(
            tooltip: tr('Scan a QR code'),
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
                title: Text(tr('Pick a username')),
                subtitle: Text(tr('So friends can find you')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => showUsernameSheet(context),
              ),
            ),
          const _OutNow(),
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
              onPressed: () => Navigator.pop(context), child: Text(tr('Done'))),
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
            hintText: tr('Find friends by @username'),
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
          Padding(
            padding: const EdgeInsets.all(KSpace.md),
            child: Text(tr('No one with that username.'),
                style: TextStyle(color: context.k.inkMuted)),
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
                        ? tr('Friends')
                        : tr('Requested'),
                    style: TextStyle(color: context.k.inkMuted))
                : FilledButton.tonal(
                    onPressed: () async {
                      try {
                        await ref
                            .read(socialRepositoryProvider)
                            .sendRequest(uid!, p.uid);
                        if (context.mounted) showMessage(context, tr('Request sent'));
                      } catch (e) {
                        if (context.mounted) showError(context, e);
                      }
                    },
                    child: Text(tr('Add')),
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
        onTap: f.status == FriendshipStatus.accepted && p != null
            ? () => _showFriend(context, ref, p, f)
            : null,
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
          SectionTitle(tr('Requests')),
          for (final f in incoming)
            tile(f,
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: tr('Decline'),
                      icon: const Icon(Icons.close),
                      onPressed: () => guard(context, () => repo.remove(f.id)),
                    ),
                    FilledButton(
                      onPressed: () => guard(context, () => repo.accept(f.id)),
                      child: Text(tr('Accept')),
                    ),
                  ],
                )),
        ],
        SectionTitle(trf('Friends ({n})', {'n': friends.length})),
        if (friends.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: KSpace.md),
            child: Text(
              tr('Search for friends above, or scan their QR code.'),
              style: TextStyle(color: context.k.inkMuted),
            ),
          ),
        for (final f in friends)
          tile(f,
              trailing: PopupMenuButton<String>(
                onSelected: (_) => guard(context, () => repo.remove(f.id)),
                itemBuilder: (_) => [
                  PopupMenuItem(value: 'remove', child: Text(tr('Remove friend'))),
                ],
              )),
        if (outgoing.isNotEmpty) ...[
          SectionTitle(tr('Sent requests')),
          for (final f in outgoing)
            tile(f,
                trailing: TextButton(
                  onPressed: () => guard(context, () => repo.remove(f.id)),
                  child: Text(tr('Cancel')),
                )),
        ],
      ],
    );
  }
}

/// Where your friends checked in today, plus your own check-in.
class _OutNow extends ConsumerWidget {
  const _OutNow();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = DateTime.now();
    final friends = ref.watch(friendsCheckInsProvider).value ?? const <CheckIn>[];
    final mine = ref.watch(myCheckInProvider).value;
    final myFresh = mine != null && mine.isFresh(now) ? mine : null;
    if (friends.isEmpty && myFresh == null) {
      return Padding(
        padding: const EdgeInsets.only(top: KSpace.sm),
        child: Text(tr('📍 When friends tap "Check in" on a place, you\'ll see where they are here.'),
            style: Theme.of(context).textTheme.bodySmall),
      );
    }
    final withLocation = friends.where((c) => c.lat != null && c.lng != null).toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionTitle(
          tr('Out now'),
          trailing: withLocation.isEmpty
              ? null
              : TextButton.icon(
                  onPressed: () => _showFriendsMap(context, withLocation),
                  icon: const Icon(Icons.map_outlined, size: 18),
                  label: Text(tr('Map')),
                ),
        ),
        if (myFresh != null)
          Card(
            child: ListTile(
              leading: const Text('🙋', style: TextStyle(fontSize: 22)),
              title: Text(trf('You: {place}', {'place': myFresh.placeName})),
              subtitle: Text(trf('Checked in {when}', {'when': timeAgo(myFresh.createdAt!, now)})),
              trailing: TextButton(
                onPressed: () async {
                  final uid = ref.read(uidProvider);
                  if (uid == null) return;
                  try {
                    await ref.read(checkInsRepositoryProvider).remove(uid);
                  } catch (e) {
                    if (context.mounted) showError(context, e);
                  }
                },
                child: Text(tr('Remove')),
              ),
              onTap: () => context.push('/place/${myFresh.placeId}'),
            ),
          ),
        for (final c in friends)
          Card(
            child: ListTile(
              leading: const Text('📍', style: TextStyle(fontSize: 22)),
              title: Text(trf('{name} is at {place}', {'name': c.name, 'place': c.placeName})),
              subtitle: Text([?c.area, timeAgo(c.createdAt!, now)].join(' · ')),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/place/${c.placeId}'),
            ),
          ),
      ],
    );
  }
}

void _showFriendsMap(BuildContext context, List<CheckIn> list) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    builder: (sheetContext) => SizedBox(
      height: MediaQuery.sizeOf(sheetContext).height * 0.75,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(KSpace.md),
            child: Text(tr('Where friends are'), style: Theme.of(sheetContext).textTheme.titleLarge),
          ),
          Expanded(
            child: KhrogaMap(
              pins: [
                for (final c in list)
                  MapPin(
                    lat: c.lat!,
                    lng: c.lng!,
                    label: '${c.name} · ${c.placeName}',
                    emoji: '🙋',
                    onTap: () {
                      Navigator.pop(sheetContext);
                      context.push('/place/${c.placeId}');
                    },
                  ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// A friend's card: their check-in, invite them to one of your groups, remove.
void _showFriend(BuildContext context, WidgetRef ref, PublicProfile p, Friendship f) {
  showModalBottomSheet<void>(
    context: context,
    useSafeArea: true,
    builder: (sheetContext) => Consumer(builder: (context, ref, _) {
      final uid = ref.watch(uidProvider);
      final checkIn = (ref.watch(friendsCheckInsProvider).value ?? const <CheckIn>[])
          .where((c) => c.uid == p.uid)
          .firstOrNull;
      final groups = (ref.watch(myGroupsProvider).value ?? const <Group>[])
          .where((g) => !g.memberUids.contains(p.uid))
          .toList();
      final text = Theme.of(context).textTheme;
      return ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Center(child: Avatar(profile: p, size: 72)),
          const SizedBox(height: KSpace.sm),
          Center(child: Text(p.displayName, style: text.titleLarge)),
          if (p.username != null) Center(child: Text('@${p.username}', style: text.bodyMedium)),
          if (checkIn != null)
            ListTile(
              leading: const Text('📍', style: TextStyle(fontSize: 22)),
              title: Text(trf('At {place}', {'place': checkIn.placeName})),
              subtitle: Text(timeAgo(checkIn.createdAt!, DateTime.now())),
              onTap: () {
                Navigator.pop(sheetContext);
                context.push('/place/${checkIn.placeId}');
              },
            ),
          SectionTitle(tr('Invite to a group')),
          if (groups.isEmpty)
            Text(tr('They\'re already in all your groups, or you have none yet.'), style: text.bodySmall),
          for (final g in groups)
            ListTile(
              leading: const Icon(Icons.group_add_outlined),
              title: Text(g.name),
              onTap: () async {
                Navigator.pop(sheetContext);
                try {
                  await ref.read(groupsRepositoryProvider).addFriend(g.id, p.uid);
                  if (context.mounted) showMessage(context, trf('Added to {name}', {'name': g.name}));
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
            ),
          const SizedBox(height: KSpace.md),
          if (uid != null)
            TextButton(
              style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
              onPressed: () async {
                Navigator.pop(sheetContext);
                try {
                  await ref.read(socialRepositoryProvider).remove(f.id);
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
              child: Text(tr('Remove friend')),
            ),
        ],
      );
    }),
  );
}
