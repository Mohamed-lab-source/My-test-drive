import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart';
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../auth/username_sheet.dart';
import 'theme_sheet.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(myProfileProvider).value;
    final user = ref.watch(authStateProvider).value;
    final isGuest = user?.isAnonymous ?? true;
    final text = Theme.of(context).textTheme;
    final auth = ref.read(authRepositoryProvider);

    return Scaffold(
      appBar: AppBar(title: Text(tr('Profile'))),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.md),
        children: [
          Center(child: Avatar(profile: me, size: 88)),
          const SizedBox(height: KSpace.md),
          Center(child: Text(me?.displayName ?? '', style: text.titleLarge)),
          if (me?.username != null)
            Center(
              child: Text('@${me!.username}',
                  style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
            ),
          const SizedBox(height: KSpace.lg),
          const _Stats(),
          const SizedBox(height: KSpace.md),
          const _Badges(),
          const _VisitedBreakdown(),
          const SizedBox(height: KSpace.md),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.palette_outlined),
                  title: Text(tr('Look & colors')),
                  subtitle: Text(tr('Dark mode, color themes, bigger text')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => showThemeSheet(context),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.location_city),
                  title: Text(tr('Home city')),
                  subtitle: Text(Cities.all[ref.watch(cityProvider)] ?? ''),
                  onTap: () => _pickCity(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: Text(tr('Display name')),
                  subtitle: Text(me?.displayName ?? ''),
                  onTap: me == null
                      ? null
                      : () => _editName(context, ref, me.displayName),
                ),
                if (!isGuest) ...[
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.alternate_email),
                    title: Text(tr('Username')),
                    subtitle: Text(me?.username == null
                        ? tr('Not set')
                        : '@${me!.username}'),
                    onTap: () => showUsernameSheet(context),
                  ),
                ],
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.cleaning_services_outlined),
                  title: Text(tr('Clear history on this phone')),
                  subtitle: Text(tr('Recently viewed, searches, star ratings, ticked stops')),
                  onTap: () => _clearHistory(context, ref),
                ),
              ],
            ),
          ),
          const SizedBox(height: KSpace.md),
          const _AppSettingsCard(),
          const SizedBox(height: KSpace.md),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.ios_share),
                  title: Text(tr('Export my data')),
                  subtitle: Text(tr('Plans, favorites, places you\'ve been, lists')),
                  onTap: () => _export(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.share_outlined),
                  title: Text(tr('Share Khroga with friends')),
                  onTap: () => SharePlus.instance.share(ShareParams(
                      text: 'I plan outings in Cairo, Giza and Alexandria with Khroga. '
                          'It only suggests real places and it\'s free. Ask me for the app!')),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.new_releases_outlined),
                  title: Text(tr("What's new")),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/whats-new'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.school_outlined),
                  title: Text(tr('Show the welcome tour again')),
                  onTap: () => context.push('/welcome'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: Text(tr('About Khroga')),
                  subtitle: Text(tr('Where our facts come from')),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/about'),
                ),
              ],
            ),
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
              if (isGuest) {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: Text(tr('Sign out of guest account?')),
                    content: Text(
                        tr("Guest plans and groups can't be recovered after signing out.")),
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
        ],
      ),
    );
  }

  /// Everything you've saved, as text you can keep or send to yourself.
  Future<void> _export(BuildContext context, WidgetRef ref) async {
    try {
      final plans = await ref.read(allPlansProvider.future);
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
    final plans = ref.watch(allPlansProvider).value?.length;
    final favorites = ref.watch(favoriteIdsProvider).value?.length;
    final visited = ref.watch(visitedIdsProvider).value?.length;
    final groups = ref.watch(myGroupsProvider).value?.length;
    final friends = ref
        .watch(friendshipsProvider)
        .value
        ?.where((f) => f.status == FriendshipStatus.accepted)
        .length;
    Widget stat(String emoji, int? n, String label) => Expanded(
          child: Column(
            children: [
              Text(emoji, style: const TextStyle(fontSize: 22)),
              Text(n == null ? '–' : '$n', style: Theme.of(context).textTheme.titleLarge),
              Text(tr(label), style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
            ],
          ),
        );
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: KSpace.md),
        child: Row(
          children: [
            stat('🗺️', plans, 'Plans'),
            stat('❤️', favorites, 'Favorites'),
            stat('✅', visited, 'Been there'),
            stat('👯', groups, 'Groups'),
            stat('🤝', friends, 'Friends'),
          ],
        ),
      ),
    );
  }
}

/// Badges earned from your own real activity.
class _Badges extends ConsumerWidget {
  const _Badges();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final visitedPlaces = ref.watch(visitedPlacesProvider).value ?? const [];
    final counts = MyCounts(
      plans: ref.watch(allPlansProvider).value?.length ?? 0,
      favorites: ref.watch(favoriteIdsProvider).value?.length ?? 0,
      visited: ref.watch(visitedIdsProvider).value?.length ?? 0,
      groups: ref.watch(myGroupsProvider).value?.length ?? 0,
      friends: ref
              .watch(friendshipsProvider)
              .value
              ?.where((f) => f.status == FriendshipStatus.accepted)
              .length ??
          0,
      visitedCategories: visitedPlaces.map((p) => p.category).toSet().length,
    );
    final badges = badgesFor(counts);
    final earned = badges.where((b) => b.earned).length;
    final text = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(KSpace.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(trf('Badges · {a} of {b}', {'a': earned, 'b': badges.length}), style: text.titleMedium),
            const SizedBox(height: KSpace.sm),
            Wrap(
              spacing: KSpace.sm,
              runSpacing: KSpace.sm,
              children: [
                for (final b in badges)
                  Tooltip(
                    message: b.earned ? b.title : 'To earn: ${b.hint}',
                    triggerMode: TooltipTriggerMode.tap,
                    child: Opacity(
                      opacity: b.earned ? 1 : 0.35,
                      child: Container(
                        width: 72,
                        padding: const EdgeInsets.symmetric(vertical: KSpace.sm),
                        decoration: BoxDecoration(
                          color: b.earned ? context.k.accentSoft : context.k.background,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          children: [
                            Text(b.emoji, style: const TextStyle(fontSize: 24)),
                            const SizedBox(height: 2),
                            Text(b.title,
                                textAlign: TextAlign.center,
                                maxLines: 2,
                                style: text.bodySmall?.copyWith(fontSize: 11)),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: KSpace.xs),
            Text(tr('Tap a badge to see how to earn it.'), style: text.bodySmall),
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
    return Card(
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.translate),
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
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode_outlined),
            title: Text(tr('Pure black dark mode')),
            subtitle: Text(tr('Darker, saves battery on many phones')),
            value: s.pureBlack,
            onChanged: n.setPureBlack,
          ),
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.data_saver_on_outlined),
            title: Text(tr('Data saver')),
            subtitle: Text(tr("Don't load place photos")),
            value: s.dataSaver,
            onChanged: n.setDataSaver,
          ),
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.explore_outlined),
            title: Text(tr('Open the app on Explore')),
            subtitle: Text(tr('Instead of Plan (next time you open it)')),
            value: s.startOnExplore,
            onChanged: n.setStartOnExplore,
          ),
        ],
      ),
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
