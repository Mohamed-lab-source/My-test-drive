import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/i18n.dart';
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';
import '../../app/pocket.dart' show exportPhoneData;
import '../../app/reminders.dart';
import '../../app/theme.dart';
import '../../app/theme_settings.dart' show sharedPrefsProvider;
import '../../data/live_share.dart' show savedTracksProvider;
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/large_title.dart';
import '../../widgets/launchers.dart';
import '../fun/badges_screen.dart' show funPrefsProvider;
import '../fun/place_of_day.dart' show syncDailyIdeas;
import 'safety_screens.dart' show deleteMyAccount;
import 'theme_sheet.dart';

/// Every setting in one place, grouped the way people look for them:
/// general, look, notifications, your data, about, account.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(appSettingsProvider);
    final n = ref.read(appSettingsProvider.notifier);
    final p = ref.watch(phoneSettingsProvider);
    final pn = ref.read(phoneSettingsProvider.notifier);
    final pocket = ref.watch(pocketPrefsProvider);
    final pp = ref.read(pocketPrefsProvider.notifier);
    final start = pocket['start'] ?? (s.startOnExplore ? 'explore' : 'plan');
    final nick = pocket['nickname'];
    const gap = SizedBox(height: KSpace.md);
    const div = Divider(indent: 68);

    Widget link(IconData icon, String title, VoidCallback onTap, {String? subtitle}) => ListTile(
          leading: IconTile(icon),
          title: Text(title),
          subtitle: subtitle == null ? null : Text(subtitle),
          trailing: const Icon(Icons.chevron_right),
          onTap: onTap,
        );

    return KScaffold(
      title: Text(tr('Settings')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          MenuGroup(title: tr('General'), children: [
            ListTile(
              leading: const IconTile(Icons.translate),
              title: const Text('Language · اللغة'),
              // Under the title, not beside it, so it fits with big text.
              subtitle: Padding(
                padding: const EdgeInsets.only(top: KSpace.xs),
                child: Wrap(spacing: KSpace.sm, runSpacing: KSpace.xs, children: [
                  for (final (code, label) in [('en', 'English'), ('ar', 'العربية')])
                    ChoiceChip(
                      label: Text(label),
                      selected: s.lang == code,
                      showCheckmark: false,
                      onSelected: (_) => n.setLanguage(code),
                    ),
                ]),
              ),
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.location_city),
              title: Text(tr('Home city')),
              subtitle: Text(tr(Cities.all[ref.watch(cityProvider)] ?? '')),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => pickHomeCity(context, ref),
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.home_outlined),
              title: Text(tr('Open the app on')),
              subtitle: DropdownButton<String>(
                isExpanded: true,
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
            div,
            ListTile(
              leading: const IconTile(Icons.waving_hand_outlined),
              title: Text(tr('Nickname for the greeting')),
              subtitle: Text(nick ?? tr('Uses your profile name')),
              trailing: const Icon(Icons.edit_outlined),
              onTap: () => _editNickname(context, ref, nick),
            ),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.schedule),
              title: Text(tr('24-hour clock')),
              subtitle: Text(p.clock24 ? '18:30' : '6:30 PM'),
              value: p.clock24,
              onChanged: pn.setClock24,
            ),
          ]),
          gap,
          MenuGroup(title: tr('Look and feel'), children: [
            link(Icons.palette_outlined, tr('Look & colors'), () => showThemeSheet(context),
                subtitle: tr('Dark mode, color themes, bigger text')),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.dark_mode_outlined),
              title: Text(tr('Pure black dark mode')),
              subtitle: Text(tr('Darker, saves battery on many phones')),
              value: s.pureBlack,
              onChanged: n.setPureBlack,
            ),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.format_bold),
              title: Text(tr('Bold text')),
              subtitle: Text(tr('Easier to read')),
              value: p.boldText,
              onChanged: pn.setBoldText,
            ),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.animation),
              title: Text(tr('Reduce motion')),
              subtitle: Text(tr('Fewer animations')),
              value: p.reduceMotion,
              onChanged: pn.setReduceMotion,
            ),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.vibration),
              title: Text(tr('Vibrate on taps')),
              value: p.haptics,
              onChanged: pn.setHaptics,
            ),
          ]),
          if (Reminders.available) ...[
            gap,
            MenuGroup(title: tr('Notifications'), children: [
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
            ]),
          ],
          gap,
          MenuGroup(title: tr('Data and privacy'), children: [
            SwitchListTile(
              secondary: const IconTile(Icons.data_saver_on_outlined),
              title: Text(tr('Data saver')),
              subtitle: Text(tr("Don't load place photos")),
              value: s.dataSaver,
              onChanged: n.setDataSaver,
            ),
            div,
            SwitchListTile(
              secondary: const IconTile(Icons.bug_report_outlined),
              title: Text(tr('Send error reports')),
              subtitle: Text(tr('Short technical notes, no personal details')),
              value: p.sendErrors,
              onChanged: pn.setSendErrors,
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.ios_share),
              title: Text(tr('Export my data')),
              subtitle: Text(tr('Plans, favorites, places you\'ve been, lists')),
              onTap: () => exportAccountData(context, ref),
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.download_outlined),
              title: Text(tr('Export my phone data')),
              subtitle: Text(tr('Your settings, lists and notes kept on this phone, as a file to save')),
              onTap: () {
                final prefs = ref.read(sharedPrefsProvider);
                if (prefs == null) return;
                final data = {for (final k in prefs.getKeys()) k: prefs.get(k)};
                SharePlus.instance.share(ShareParams(text: exportPhoneData(data), subject: tr('My Khroga phone data')));
              },
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.cleaning_services_outlined),
              title: Text(tr('Clear history on this phone')),
              subtitle: Text(tr('Recently viewed, searches, star ratings, ticked stops, routes')),
              onTap: () => clearPhoneHistory(context, ref),
            ),
            div,
            ListTile(
              leading: const IconTile(Icons.cleaning_services_outlined),
              title: Text(tr('Clear my tool data')),
              subtitle: Text(tr('Scores, countdowns, quick replies, starred tools')),
              onTap: () => _clearToolData(context, ref),
            ),
            div,
            link(Icons.block, tr('Blocked people'), () => context.push('/blocked')),
            div,
            link(Icons.privacy_tip_outlined, tr('Privacy policy'), () => context.push('/privacy')),
            div,
            link(Icons.gavel_outlined, tr('Terms of use'), () => context.push('/terms')),
          ]),
          gap,
          MenuGroup(title: tr('About'), children: [
            link(Icons.new_releases_outlined, tr("What's new"), () => context.push('/whats-new')),
            div,
            link(Icons.school_outlined, tr('Show the welcome tour again'), () => context.push('/welcome')),
            div,
            ListTile(
              leading: const IconTile(Icons.system_update_outlined),
              title: Text(tr('Check for a new version')),
              subtitle: Text(tr('Opens the download page')),
              onTap: () => openWebsite('https://github.com/Mohamed-lab-source/My-test-drive/releases/tag/latest-apk'),
            ),
            div,
            link(Icons.info_outline, tr('About Khroga'), () => context.push('/about'),
                subtitle: tr('Where our facts come from')),
          ]),
          gap,
          MenuGroup(title: tr('Account'), children: [
            ListTile(
              leading: IconTile(Icons.delete_forever_outlined, hue: 0),
              title: Text(tr('Delete my account'),
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
              subtitle: Text(tr('Deletes your plans, groups you made, reviews and everything else')),
              onTap: () => deleteMyAccount(context, ref),
            ),
          ]),
        ],
      ),
    );
  }
}

Future<void> _editNickname(BuildContext context, WidgetRef ref, String? nick) async {
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
  disposeLater(c);
  if (v != null) ref.read(pocketPrefsProvider.notifier).set('nickname', v.isEmpty ? null : v);
}

Future<void> _clearToolData(BuildContext context, WidgetRef ref) async {
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
    ref.read(pocketPrefsProvider.notifier).set(k, null);
  }
  ref.invalidate(scoresProvider);
  ref.invalidate(myDatesProvider);
  ref.invalidate(quickRepliesProvider);
  if (context.mounted) showMessage(context, tr('Cleared'));
}

/// Pick the city Khroga shows first.
Future<void> pickHomeCity(BuildContext context, WidgetRef ref) async {
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

/// Clears what this phone remembers (not your account data).
Future<void> clearPhoneHistory(BuildContext context, WidgetRef ref) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('Clear history on this phone?')),
      content: Text(tr('Your plans, favorites, notes and groups are not affected.')),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(tr('Cancel'))),
        FilledButton(onPressed: () => Navigator.pop(dialogContext, true), child: Text(tr('Clear'))),
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

/// Everything you've saved, as text you can keep or send to yourself.
Future<void> exportAccountData(BuildContext context, WidgetRef ref) async {
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
