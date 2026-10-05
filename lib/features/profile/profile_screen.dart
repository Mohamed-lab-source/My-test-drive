import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart';
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
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
      appBar: AppBar(title: const Text('Profile')),
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
          const SizedBox(height: KSpace.md),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.palette_outlined),
                  title: const Text('Look & colors'),
                  subtitle: const Text('Dark mode, color themes, bigger text'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => showThemeSheet(context),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.location_city),
                  title: const Text('Home city'),
                  subtitle: Text(Cities.all[ref.watch(cityProvider)] ?? ''),
                  onTap: () => _pickCity(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.badge_outlined),
                  title: const Text('Display name'),
                  subtitle: Text(me?.displayName ?? ''),
                  onTap: me == null
                      ? null
                      : () => _editName(context, ref, me.displayName),
                ),
                if (!isGuest) ...[
                  const Divider(),
                  ListTile(
                    leading: const Icon(Icons.alternate_email),
                    title: const Text('Username'),
                    subtitle: Text(me?.username == null
                        ? 'Not set'
                        : '@${me!.username}'),
                    onTap: () => showUsernameSheet(context),
                  ),
                ],
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.cleaning_services_outlined),
                  title: const Text('Clear history on this phone'),
                  subtitle: const Text('Recently viewed, searches, star ratings, ticked stops'),
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
                  title: const Text('Export my data'),
                  subtitle: const Text('Plans, favorites, places you\'ve been, lists'),
                  onTap: () => _export(context, ref),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.share_outlined),
                  title: const Text('Share Khroga with friends'),
                  onTap: () => SharePlus.instance.share(ShareParams(
                      text: 'I plan outings in Cairo, Giza and Alexandria with Khroga. '
                          'It only suggests real places and it\'s free. Ask me for the app!')),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.new_releases_outlined),
                  title: const Text("What's new"),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/whats-new'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.school_outlined),
                  title: const Text('Show the welcome tour again'),
                  onTap: () => context.push('/welcome'),
                ),
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text('About Khroga'),
                  subtitle: const Text('Where our facts come from'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/about'),
                ),
              ],
            ),
          ),
          const SizedBox(height: KSpace.md),
          if (isGuest) ...[
            Text(
              "You're using Khroga as a guest. Sign in to keep your plans on "
              'any phone and to add friends.',
              style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
            ),
            const SizedBox(height: KSpace.sm),
            BusyButton(
              label: 'Sign in with Google',
              icon: Icons.login,
              onPressed: auth.signInWithGoogle,
            ),
            const SizedBox(height: KSpace.sm),
          ],
          BusyButton(
            label: 'Sign out',
            outlined: true,
            onPressed: () async {
              if (isGuest) {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (dialogContext) => AlertDialog(
                    title: const Text('Sign out of guest account?'),
                    content: const Text(
                        "Guest plans and groups can't be recovered after signing out."),
                    actions: [
                      TextButton(
                          onPressed: () => Navigator.pop(dialogContext, false),
                          child: const Text('Cancel')),
                      FilledButton(
                          onPressed: () => Navigator.pop(dialogContext, true),
                          child: const Text('Sign out')),
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
        title: const Text('Home city'),
        children: [
          for (final e in Cities.all.entries)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(dialogContext, e.key),
              child: Text(e.value),
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
        title: const Text('Clear history on this phone?'),
        content: const Text(
            'Your plans, favorites, notes and groups are not affected.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Clear')),
        ],
      ),
    );
    if (ok != true) return;
    ref.read(recentPlacesProvider.notifier).clear();
    ref.read(searchHistoryProvider.notifier).clear();
    ref.read(myRatingsProvider.notifier).clear();
    ref.read(planChecklistProvider.notifier).clear();
    if (context.mounted) showMessage(context, 'History cleared');
  }

  Future<void> _editName(BuildContext context, WidgetRef ref, String current) async {
    final controller = TextEditingController(text: current);
    final name = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Display name'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 40,
          textCapitalization: TextCapitalization.words,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, controller.text),
              child: const Text('Save')),
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
              Text(label, style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.center),
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
            Text('Badges · $earned of ${badges.length}', style: text.titleMedium),
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
            Text('Tap a badge to see how to earn it.', style: text.bodySmall),
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
          SwitchListTile(
            secondary: const Icon(Icons.dark_mode_outlined),
            title: const Text('Pure black dark mode'),
            subtitle: const Text('Darker, saves battery on many phones'),
            value: s.pureBlack,
            onChanged: n.setPureBlack,
          ),
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.data_saver_on_outlined),
            title: const Text('Data saver'),
            subtitle: const Text("Don't load place photos"),
            value: s.dataSaver,
            onChanged: n.setDataSaver,
          ),
          const Divider(),
          SwitchListTile(
            secondary: const Icon(Icons.explore_outlined),
            title: const Text('Open the app on Explore'),
            subtitle: const Text('Instead of Plan (next time you open it)'),
            value: s.startOnExplore,
            onChanged: n.setStartOnExplore,
          ),
        ],
      ),
    );
  }
}
