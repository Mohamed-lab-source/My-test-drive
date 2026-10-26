import '../../app/pocket.dart' show exportPhoneData;
import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/local_history.dart';
import '../../app/local_prefs.dart';
import '../../app/review.dart';
import '../../app/share_texts.dart';

import '../../app/theme.dart';
import '../../app/theme_settings.dart' show sharedPrefsProvider;
import '../../data/providers.dart';
import '../../data/live_share.dart' show savedTracksProvider;
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../models/review.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/motion.dart';
import '../auth/username_sheet.dart';
import 'safety_screens.dart' show deleteMyAccount;
import 'theme_sheet.dart';
import '../fun/badges_screen.dart' show BadgesSummaryCard, funPrefsProvider;
import '../fun/place_of_day.dart' show syncDailyIdeas;
import '../../app/reminders.dart';
import '../../widgets/launchers.dart';

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
          const _VisitedBreakdown(),
          const SizedBox(height: KSpace.md),
          TileGrid(
            title: tr('Your outings'),
              items: [
                for (final (icon, title, sub, path) in [
                  (Icons.auto_stories_outlined, tr('My timeline'), tr('Every place you\'ve been, by date'), '/timeline'),
                  (Icons.celebration_outlined, tr('My recap'), tr('Your month or year on Khroga, and your outing personality'), '/recap'),
                  (Icons.grid_view, tr('Monthly bingo'), tr('9 kinds of places to try this month'), '/bingo'),
                  (Icons.leaderboard_outlined, tr('Friends leaderboard'), tr('Who has the most guide points'), '/leaderboard'),
                  (Icons.collections_bookmark_outlined, tr('Collections'), tr('Work spots, open late, wheelchair friendly…'), '/collections'),
                  (Icons.insights_outlined, tr('My outings in numbers'), tr('Streaks, top areas, kinds of places'), '/stats'),
                  (Icons.map_outlined, tr('My map'), tr('Favorites and places you\'ve been'), '/my-map'),
                  (Icons.route, tr('Track my outing'), tr('Record your route, distance and time'), '/track'),
                  (Icons.sticky_note_2_outlined, tr('My notes'), tr('All your private notes'), '/notes'),
                  (Icons.handyman_outlined, tr('Outing tools'), tr('Decide for us, who pays, sunset, holidays'), '/tools'),
                  (Icons.lightbulb_outline, tr('Outing ideas'), tr('Ready-made plans to start from'), '/ideas'),
                  (Icons.holiday_village_outlined, tr('Areas'), tr('Every neighbourhood we have places in'), '/areas'),
                ]) (icon, title, sub, () => context.push(path)),
              ],
          ),
          const SizedBox(height: KSpace.md),
          MenuGroup(
            title: tr('You'),
              children: [
                ListTile(
                  leading: const IconTile(Icons.palette_outlined),
                  title: Text(tr('Look & colors')),
                  subtitle: Text(tr('Dark mode, color themes, bigger text')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => showThemeSheet(context),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.location_city),
                  title: Text(tr('Home city')),
                  subtitle: Text(Cities.all[ref.watch(cityProvider)] ?? ''),
                  onTap: () => _pickCity(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.badge_outlined),
                  title: Text(tr('Display name')),
                  subtitle: Text(me?.displayName ?? ''),
                  onTap: me == null
                      ? null
                      : () => _editName(context, ref, me.displayName),
                ),
                if (!isGuest) ...[
                  const Divider(),
                  ListTile(
                    leading: const IconTile(Icons.alternate_email),
                    title: Text(tr('Username')),
                    subtitle: Text(me?.username == null
                        ? tr('Not set')
                        : '@${me!.username}'),
                    onTap: () => showUsernameSheet(context),
                  ),
                ],
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.cleaning_services_outlined),
                  title: Text(tr('Clear history on this phone')),
                  subtitle: Text(tr('Recently viewed, searches, star ratings, ticked stops, routes')),
                  onTap: () => _clearHistory(context, ref),
                ),
              ],
          ),
          const SizedBox(height: KSpace.md),
          const _AppSettingsCard(),
          const SizedBox(height: KSpace.md),
          MenuGroup(
            title: tr('More'),
              children: [
                ListTile(
                  leading: const IconTile(Icons.ios_share),
                  title: Text(tr('Export my data')),
                  subtitle: Text(tr('Plans, favorites, places you\'ve been, lists')),
                  onTap: () => _export(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.share_outlined),
                  title: Text(tr('Share Khroga with friends')),
                  onTap: () => SharePlus.instance.share(ShareParams(text: appInviteText())),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.star_outline),
                  title: Text(tr('Rate Khroga')),
                  subtitle: Text(tr('A good rating helps more people find it')),
                  onTap: openStoreListing,
                ),
                const Divider(),
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
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.new_releases_outlined),
                  title: Text(tr("What's new")),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/whats-new'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.help_outline),
                  title: Text(tr('Help & questions')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/help'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.feedback_outlined),
                  title: Text(tr('Report a problem or idea')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/feedback'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.system_update_outlined),
                  title: Text(tr('Check for a new version')),
                  subtitle: Text(tr('Opens the download page')),
                  onTap: () => openWebsite(
                      'https://github.com/Mohamed-lab-source/My-test-drive/releases/tag/latest-apk'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.block),
                  title: Text(tr('Blocked people')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/blocked'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.privacy_tip_outlined),
                  title: Text(tr('Privacy policy')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/privacy'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.gavel_outlined),
                  title: Text(tr('Terms of use')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/terms'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.school_outlined),
                  title: Text(tr('Show the welcome tour again')),
                  onTap: () => context.push('/welcome'),
                ),
                const Divider(),
                ListTile(
                  leading: const IconTile(Icons.info_outline),
                  title: Text(tr('About Khroga')),
                  subtitle: Text(tr('Where our facts come from')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/about'),
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
          const SizedBox(height: KSpace.lg),
          TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => deleteMyAccount(context, ref),
            icon: const Icon(Icons.delete_forever_outlined),
            label: Text(tr('Delete my account')),
          ),
        ],
      ),
    );
  }

  /// Everything you've saved, as text you can keep or send to yourself.
  Future<void> _export(BuildContext context, WidgetRef ref) async {
    try {
      final uid = ref.read(uidProvider);
      if (uid == null) return;
      final plans = await ref.read(plansRepositoryProvider).getAll(uid);
      final favorites = await ref.read(favoritePlacesProvider.future);
      final visited = await ref.read(visitedPlacesProvider.future);
      final all = await ref.read(allPlacesProvider.future);
      final byId = {for (final p in all) p.id: p.name};
      final lists = ref.read(placeListsProvider);
      final out = StringBuffer('My Khroga data\n\n');
      out.writeln('PLANS (${plans.length})');
      for (final p in plans) {
        out.writeln('• ${p.title}: ${p.stops.map((s) => s.name).join(' → ')}');
      }
      out.writeln('\nFAVORITES (${favorites.length})');
      for (final p in favorites) {
        out.writeln('• ${p.name}${p.area == null ? '' : ' (${p.area})'}');
      }
      out.writeln("\nPLACES I'VE BEEN (${visited.length})");
      for (final p in visited) {
        out.writeln('• ${p.name}');
      }
      for (final e in lists.entries) {
        out.writeln('\nLIST: ${e.key}');
        for (final id in e.value) {
          if (byId[id] != null) out.writeln('• ${byId[id]}');
        }
      }
      await SharePlus.instance.share(ShareParams(text: out.toString(), subject: 'My Khroga data'));
    } catch (e) {
      if (context.mounted) showError(context, e);
    }
  }

  Future<void> _pickCity(BuildContext context, WidgetRef ref) async {
    final picked = await showDialog<String>(
      context: context,
      builder: (dialogContext) => SimpleDialog(
        title: Text(tr('Home city')),
        children: [
          for (final e in Cities.all.entries)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(dialogContext, e.key),
              child: Text(tr(e.value)),
            ),
        ],
      ),
    );
    if (picked != null) ref.read(cityProvider.notifier).set(picked);
  }

  Future<void> _clearHistory(BuildContext context, WidgetRef ref) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(tr('Clear history on this phone?')),
        content: Text(
            tr('Your plans, favorites, notes and groups are not affected.')),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: Text(tr('Cancel'))),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: Text(tr('Clear'))),
        ],
      ),
    );
    if (ok != true) return;
    ref.read(recentPlacesProvider.notifier).clear();
    ref.read(searchHistoryProvider.notifier).clear();
    ref.read(myRatingsProvider.notifier).clear();
    ref.read(planChecklistProvider.notifier).clear();
    await ref.read(sharedPrefsProvider)?.remove('tracks');
    ref.invalidate(savedTracksProvider);
    if (context.mounted) showMessage(context, tr('History cleared'));
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
            onTap: () => route == '/saved' ? context.push(route) : context.go(route),
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
            stat('🗺️', plans, 'Plans', '/saved'),
            stat('❤️', favorites, 'Favorites', '/saved'),
            stat('✅', visited, 'Been there', '/saved'),
            stat('👯', groups, 'Groups', '/groups'),
            stat('🤝', friends, 'Friends', '/friends'),
          ],
        ),
      ),
    );
  }
}

/// Phone-only app settings.
class _AppSettingsCard extends ConsumerWidget {
  const _AppSettingsCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(appSettingsProvider);
    final n = ref.read(appSettingsProvider.notifier);
    return MenuGroup(
        title: tr('Settings'),
        children: [
          ListTile(
            leading: const IconTile(Icons.translate),
            title: const Text('Language · اللغة'),
            trailing: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: 'en', label: Text('English')),
                ButtonSegment(value: 'ar', label: Text('العربية')),
              ],
              selected: {s.lang},
              onSelectionChanged: (v) => n.setLanguage(v.first),
            ),
          ),
          if (Reminders.available) ...[
            const Divider(),
            SwitchListTile(
              secondary: const IconTile(Icons.wb_sunny_outlined),
              title: Text(tr('Daily place idea')),
              subtitle: Text(tr('A notification at 10:00 with the place of the day')),
              value: ref.watch(funPrefsProvider)['dailyIdea'] == '1',
              onChanged: (v) async {
                if (v && !await Reminders.askPermission()) {
                  if (context.mounted) {
                    showMessage(context, tr('Notifications are off for Khroga. Turn them on in your phone settings.'));
                  }
                  return;
                }
                ref.read(funPrefsProvider.notifier).set('dailyIdea', v ? '1' : null);
                await syncDailyIdeas(ref, force: true);
              },
            ),
          ],
          const Divider(),
          SwitchListTile(
            secondary: const IconTile(Icons.dark_mode_outlined),
            title: Text(tr('Pure black dark mode')),
            subtitle: Text(tr('Darker, saves battery on many phones')),
            value: s.pureBlack,
            onChanged: n.setPureBlack,
          ),
          const Divider(),
          SwitchListTile(
            secondary: const IconTile(Icons.data_saver_on_outlined),
            title: Text(tr('Data saver')),
            subtitle: Text(tr("Don't load place photos")),
            value: s.dataSaver,
            onChanged: n.setDataSaver,
          ),
          const Divider(),
          Consumer(builder: (context, ref, _) {
            final p = ref.watch(phoneSettingsProvider);
            final pn = ref.read(phoneSettingsProvider.notifier);
            return Column(children: [
              SwitchListTile(
                secondary: const IconTile(Icons.schedule),
                title: Text(tr('24-hour clock')),
                subtitle: Text(p.clock24 ? '18:30' : '6:30 PM'),
                value: p.clock24,
                onChanged: pn.setClock24,
              ),
              const Divider(indent: 68),
              SwitchListTile(
                secondary: const IconTile(Icons.vibration),
                title: Text(tr('Vibrate on taps')),
                value: p.haptics,
                onChanged: pn.setHaptics,
              ),
              const Divider(indent: 68),
              SwitchListTile(
                secondary: const IconTile(Icons.animation),
                title: Text(tr('Reduce motion')),
                subtitle: Text(tr('Fewer animations')),
                value: p.reduceMotion,
                onChanged: pn.setReduceMotion,
              ),
              const Divider(indent: 68),
              SwitchListTile(
                secondary: const IconTile(Icons.format_bold),
                title: Text(tr('Bold text')),
                subtitle: Text(tr('Easier to read')),
                value: p.boldText,
                onChanged: pn.setBoldText,
              ),
              const Divider(indent: 68),
              SwitchListTile(
                secondary: const IconTile(Icons.bug_report_outlined),
                title: Text(tr('Send error reports')),
                subtitle: Text(tr('Short technical notes, no personal details')),
                value: p.sendErrors,
                onChanged: pn.setSendErrors,
              ),
            ]);
          }),
          Consumer(builder: (context, ref, _) {
            final pocket = ref.watch(pocketPrefsProvider);
            final pp = ref.read(pocketPrefsProvider.notifier);
            final start = pocket['start'] ?? (s.startOnExplore ? 'explore' : 'plan');
            final nick = pocket['nickname'];
            return Column(children: [
              ListTile(
                leading: const IconTile(Icons.home_outlined),
                title: Text(tr('Open the app on')),
                subtitle: Text(tr('Next time you open it')),
                trailing: DropdownButton<String>(
                  value: start,
                  underline: const SizedBox.shrink(),
                  items: [
                    DropdownMenuItem(value: 'plan', child: Text(tr('Home'))),
                    DropdownMenuItem(value: 'plans', child: Text(tr('My plans'))),
                    DropdownMenuItem(value: 'explore', child: Text(tr('Explore'))),
                  ],
                  onChanged: (v) {
                    if (v == null) return;
                    pp.set('start', v);
                    n.setStartOnExplore(v == 'explore');
                  },
                ),
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.waving_hand_outlined),
                title: Text(tr('Nickname for the greeting')),
                subtitle: Text(nick ?? tr('Uses your profile name')),
                trailing: const Icon(Icons.edit_outlined),
                onTap: () async {
                  final c = TextEditingController(text: nick ?? '');
                  final v = await showDialog<String>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: Text(tr('Nickname')),
                      content: TextField(
                        controller: c,
                        autofocus: true,
                        maxLength: 20,
                        decoration: InputDecoration(hintText: tr('Only shown to you, on this phone')),
                      ),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(d), child: Text(tr('Cancel'))),
                        FilledButton(onPressed: () => Navigator.pop(d, c.text.trim()), child: Text(tr('Save'))),
                      ],
                    ),
                  );
                  c.dispose();
                  if (v != null) pp.set('nickname', v.isEmpty ? null : v);
                },
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.cleaning_services_outlined),
                title: Text(tr('Clear my tool data')),
                subtitle: Text(tr('Scores, countdowns, quick replies, starred tools')),
                onTap: () async {
                  final ok = await showDialog<bool>(
                    context: context,
                    builder: (d) => AlertDialog(
                      title: Text(tr('Clear my tool data?')),
                      content: Text(tr('This only removes them from this phone.')),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr('Cancel'))),
                        FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr('Clear'))),
                      ],
                    ),
                  );
                  if (ok != true) return;
                  final prefs = ref.read(sharedPrefsProvider);
                  for (final k in ['tool.scores', 'tool.dates', 'chat.quick']) {
                    await prefs?.remove(k);
                  }
                  for (final k in ['tools.stars', 'tools.recent']) {
                    pp.set(k, null);
                  }
                  ref.invalidate(scoresProvider);
                  ref.invalidate(myDatesProvider);
                  ref.invalidate(quickRepliesProvider);
                  if (context.mounted) showMessage(context, tr('Cleared'));
                },
              ),
              const Divider(indent: 68),
              ListTile(
                leading: const IconTile(Icons.download_outlined),
                title: Text(tr('Export my phone data')),
                subtitle: Text(tr('Your settings, lists and notes kept on this phone, as a file to save')),
                onTap: () {
                  final prefs = ref.read(sharedPrefsProvider);
                  if (prefs == null) return;
                  final data = {for (final k in prefs.getKeys()) k: prefs.get(k)};
                  SharePlus.instance.share(ShareParams(
                    text: exportPhoneData(data),
                    subject: tr('My Khroga phone data'),
                  ));
                },
              ),
            ]);
          }),
        ],
    );
  }
}

/// What kinds of places you've been to, as simple bars.
class _VisitedBreakdown extends ConsumerWidget {
  const _VisitedBreakdown();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visited = ref.watch(visitedPlacesProvider).value ?? const [];
    if (visited.isEmpty) return const SizedBox.shrink();
    final counts = <String, int>{};
    for (final p in visited) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    final top = counts.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final max = top.first.value;
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(top: KSpace.md),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(tr("Where you've been"), style: text.titleMedium),
              const SizedBox(height: KSpace.sm),
              for (final e in top.take(6))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      SizedBox(
                        width: 120,
                        child: Text('${Categories.emoji(e.key)} ${Categories.label(e.key)}',
                            overflow: TextOverflow.ellipsis),
                      ),
                      Expanded(
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: LinearProgressIndicator(
                            value: e.value / max,
                            minHeight: 10,
                            color: context.k.accent,
                            backgroundColor: context.k.accentSoft,
                          ),
                        ),
                      ),
                      SizedBox(width: 32, child: Text('${e.value}', textAlign: TextAlign.end)),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Your Khroga Guide level, from your reviews.
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
