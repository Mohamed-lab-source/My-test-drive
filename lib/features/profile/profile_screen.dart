import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/review.dart';
import '../../app/share_texts.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/review.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';
import '../auth/username_sheet.dart';
import '../fun/badges_screen.dart' show BadgesSummaryCard;

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(myProfileProvider).value;
    final user = ref.watch(authStateProvider).value;
    final isGuest = user?.isAnonymous ?? true;
    final text = Theme.of(context).textTheme;
    final auth = ref.read(authRepositoryProvider);

    return KScaffold(
      title: Text(tr('Profile')),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          FadeSlideIn(
            child: HeroCard(
              child: Row(children: [
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: context.k.onHero.withValues(alpha: 0.6), width: 2),
                  ),
                  child: Avatar(profile: me, size: 76),
                ),
                const SizedBox(width: KSpace.md),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(me?.displayName ?? '',
                        style: text.headlineSmall?.copyWith(color: context.k.onHero),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis),
                    if (me?.username != null)
                      Text('@${me!.username}',
                          style: text.bodyMedium?.copyWith(color: context.k.onHero.withValues(alpha: 0.85))),
                  ]),
                ),
              ]),
            ),
          ),
          const SizedBox(height: KSpace.md),
          const _Stats(),
          const SizedBox(height: KSpace.md),
          const _GuideCard(),
          const BadgesSummaryCard(),
          const SizedBox(height: KSpace.md),
          TileGrid(
            title: tr('Your outings'),
              items: [
                for (final (icon, title, sub, path) in [
                  (Icons.auto_stories_outlined, tr('My timeline'), tr('Every place you\'ve been, by date'), '/timeline'),
                  (Icons.celebration_outlined, tr('My recap'), tr('Your month or year on Khroga, and your outing personality'), '/recap'),
                  (Icons.grid_view, tr('Monthly bingo'), tr('9 kinds of places to try this month'), '/bingo'),
                  (Icons.leaderboard_outlined, tr('Friends leaderboard'), tr('Who has the most guide points'), '/leaderboard'),
                  (Icons.insights_outlined, tr('My outings in numbers'), tr('Streaks, top areas, kinds of places'), '/stats'),
                  (Icons.map_outlined, tr('My map'), tr('Favorites and places you\'ve been'), '/my-map'),
                  (Icons.route, tr('Track my outing'), tr('Record your route, distance and time'), '/track'),
                  (Icons.sticky_note_2_outlined, tr('My notes'), tr('All your private notes'), '/notes'),
                  (Icons.handyman_outlined, tr('Outing tools'), tr('Decide for us, who pays, sunset, holidays'), '/tools'),
                ]) (icon, title, sub, () => context.push(path)),
              ],
          ),
          const SizedBox(height: KSpace.md),
          MenuGroup(
            title: tr('You'),
            children: [
              ListTile(
                leading: const IconTile(Icons.badge_outlined),
                title: Text(tr('Display name')),
                subtitle: Text(me?.displayName ?? ''),
                trailing: const Icon(Icons.edit_outlined),
                onTap: me == null ? null : () => _editName(context, ref, me.displayName),
              ),
              if (!isGuest) ...[
                const Divider(indent: 68),
                ListTile(
                  leading: const IconTile(Icons.alternate_email),
                  title: Text(tr('Username')),
                  subtitle: Text(me?.username == null ? tr('Not set') : '@${me!.username}'),
                  trailing: const Icon(Icons.edit_outlined),
                  onTap: () => showUsernameSheet(context),
                ),
              ],
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.settings_outlined),
                title: Text(tr('Settings')),
                subtitle: Text(tr('Language, city, look, notifications, your data')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/settings'),
              ),
            ],
          ),
          const SizedBox(height: KSpace.md),
          MenuGroup(
            title: tr('Share and help'),
            children: [
              ListTile(
                leading: const IconTile(Icons.share_outlined),
                title: Text(tr('Share Khroga with friends')),
                onTap: () => SharePlus.instance.share(ShareParams(text: appInviteText())),
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.person_add_alt_1_outlined),
                title: Text(tr('Invite a friend to add you')),
                subtitle: Text(tr('Sends a link that adds you as a friend')),
                onTap: () {
                  final uid = ref.read(uidProvider);
                  if (uid == null) return;
                  SharePlus.instance.share(ShareParams(text: friendInviteText(uid, me?.username)));
                },
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.star_outline),
                title: Text(tr('Rate Khroga')),
                subtitle: Text(tr('A good rating helps more people find it')),
                onTap: openStoreListing,
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.help_outline),
                title: Text(tr('Help & questions')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/help'),
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.feedback_outlined),
                title: Text(tr('Report a problem or idea')),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => context.push('/feedback'),
              ),
            ],
          ),
          const SizedBox(height: KSpace.md),
          if (isGuest) ...[
            Text(
              tr("You're using Khroga as a guest. Sign in to keep your plans on "
              'any phone and to add friends.'),
              style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
            ),
            const SizedBox(height: KSpace.sm),
            BusyButton(
              label: tr('Sign in with Google'),
              icon: Icons.login,
              onPressed: auth.signInWithGoogle,
            ),
            const SizedBox(height: KSpace.sm),
          ],
          BusyButton(
            label: tr('Sign out'),
            outlined: true,
            onPressed: () async {
              {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: Text(isGuest ? tr('Sign out of guest account?') : tr('Sign out?')),
                    content: Text(isGuest
                        ? tr("Guest plans and groups can't be recovered after signing out.")
                        : tr('Your plans and groups stay safe. Sign in again to see them.')),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: Text(tr('Cancel'))),
                      FilledButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: Text(tr('Sign out'))),
                    ],
                  ),
                );
                if (ok != true) return;
              }
              await auth.signOut();
            },
          ),
          const SizedBox(height: KSpace.sm),
          Center(
            child: TextButton(
              onPressed: () => context.push('/settings'),
              child: Text(tr('Delete my account is in Settings → Account'),
                  style: Theme.of(context).textTheme.bodySmall),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _editName(BuildContext context, WidgetRef ref, String current) async {
    final controller = TextEditingController(text: current);
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr('Display name')),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(tr('Cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text),
              child: Text(tr('Save'))),
        ],
      ),
    );
    controller.dispose();
    if (name == null || name.trim().isEmpty) return;
    final uid = ref.read(uidProvider);
    if (uid == null) return;
    try {
      await ref.read(socialRepositoryProvider).updateDisplayName(uid, name);
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }
}

/// A few numbers about how you use Khroga (all from your own account).
class _Stats extends ConsumerWidget {
  const _Stats();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plans = ref.watch(plansCountProvider).value;
    final favorites = ref.watch(favoriteIdsProvider).value?.length;
    final visited = ref.watch(visitedIdsProvider).value?.length;
    final groups = ref.watch(myGroupsProvider).value?.length;
    final friends = ref
        .watch(friendshipsProvider)
        .value
        ?.where((f) => f.status == FriendshipStatus.accepted)
        .length;
    Widget stat(String emoji, int? n, String label, String route) => Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () => route.startsWith('/saved') ? context.push(route) : context.go(route),
            child: Column(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 22)),
                n == null
                    ? Text('–', style: Theme.of(context).textTheme.titleLarge)
                    : DotNumber(n, size: 26),
                Text(tr(label), style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
              ],
            ),
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: KSpace.md),
        child: Row(
          children: [
            stat('🗺️', plans, 'Plans', '/plans'),
            stat('❤️', favorites, 'Favorites', '/saved'),
            stat('✅', visited, 'Been there', '/saved?been=1'),
            stat('👯', groups, 'Groups', '/groups'),
            stat('🤝', friends, 'Friends', '/friends'),
          ],
        ),
      ),
    );
  }
}

/// Phone-only app settings.
class _GuideCard extends ConsumerWidget {
  const _GuideCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(myReviewerStatsProvider).value ?? const ReviewerStats();
    final tier = tierFor(s.points);
    final next = nextTier(s.points);
    return Card(
      child: ListTile(
        leading: Text(tier.emoji, style: const TextStyle(fontSize: 30)),
        title: Text(guideTitle(s)),
        subtitle: Text(next == null
            ? trf('{n} points', {'n': s.points})
            : trf('{n} points · {m} more to {tier}', {'n': s.points, 'm': next.$2, 'tier': next.$1.name})),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/guide'),
      ),
    );
  }
}
