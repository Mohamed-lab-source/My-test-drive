import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import 'about_screen.dart' show appVersion;

/// A simple page of headed paragraphs (privacy policy, terms).
/// The same page on the free Firebase website (e.g. for the Play Store),
/// or null in builds without Firebase.
Uri? webPage(String name) {
  try {
    final id = Firebase.app().options.projectId;
    return Uri.https('$id.web.app', '/$name');
  } catch (_) {
    return null;
  }
}

class _TextPage extends StatelessWidget {
  const _TextPage({required this.title, required this.sections, this.web});

  final String title;
  final List<(String, String)> sections;

  /// File name of the web version, e.g. 'privacy.html'.
  final String? web;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(tr(title)),
        actions: [
          if (web != null && webPage(web!) != null)
            IconButton(
              tooltip: tr('Open on the web'),
              icon: const Icon(Icons.open_in_browser),
              onPressed: () => openUri(webPage(web!)!),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.lg, 0, KSpace.lg, KSpace.xl),
        children: [
          for (final (h, body) in sections) ...[
            const SizedBox(height: KSpace.md),
            Text(tr(h), style: text.titleMedium),
            const SizedBox(height: KSpace.xs),
            Text(tr(body), style: text.bodyMedium?.copyWith(color: context.k.inkMuted)),
          ],
        ],
      ),
    );
  }
}

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) => const _TextPage(title: 'Privacy policy', web: 'privacy.html', sections: [
        ('What we keep', 'Your display name, username and photo (if you sign in with Google), your plans, favorites, places you\'ve been, private notes, groups, messages, polls, friends and check-ins. They are stored in Google Firebase.'),
        ('Who can see it', 'Plans, favorites, notes and "been there" are private to you. Group members see the group\'s messages, polls and plan. Friends see your check-ins for 24 hours. Anyone signed in can see your display name, username and photo.'),
        ('Only on your phone', 'Recently viewed places, searches, your star ratings, lists, ticked stops, things-to-bring lists and settings never leave your phone.'),
        ('Reviews', 'Reviews you write (stars, your answers to the quick questions, including what you spent if you say, and your words) are public: any signed-in Khroga user can see them with your display name and guide level. You can edit or delete them any time.'),
        ('How busy is it now', 'When you tap Quiet, Normal or Busy on a place, only the count goes into that place\'s public numbers, with no name. A private note of when you last reported that place is kept under your account (so one person can\'t report it again and again); deleting your account deletes it.'),
        ('Reminders', 'Outing reminders are set and shown by your phone itself. Nothing about them is sent to us.'),
        ('Groups and helpful votes', 'Things on a group\'s "who brings what" list, and who said they\'ll bring them, are seen by that group\'s members. When you mark a review helpful, the number of helpful votes is public; a private copy under your account lets "Delete my account" remove your votes.'),
        ('Around here', 'When you open "Around here" on a place, only that place\'s map coordinates are sent to Wikipedia and Wikimedia Commons to find articles and photos nearby. The optional daily place idea is a notification set on your phone.'),
        ('Location', 'Your location is used only when you tap "Near me", "How far?", "Send my location" or "Check in", or while you choose to use Track my outing or share your live location. We never track you in the background.'),
        ('Live location', 'If you share your live location with a group, its members see where you are on the group\'s map, and your "On my way" / "I\'m here" status, only for the time you picked (at most 4 hours) and only while Khroga is open. It stops by itself, and your spot is deleted when you stop, leave the group or delete your account.'),
        ('Track my outing', 'Routes you record with Track my outing stay only on your phone. Nothing about them is sent to us.'),
        ('Camera', 'The camera is used only to scan Khroga QR codes, on your phone. No photos are taken or uploaded.'),
        ('AI', 'When you ask the AI to write a plan, the plan request and a list of real places are sent to Google Gemini. Your name and messages are never sent.'),
        ('Error reports', 'If the app hits an error, a short technical report (no messages or personal details) may be saved so we can fix it. You can turn this off in Profile.'),
        ('Deleting your data', 'Profile → Delete my account removes everything we keep about you, right away.'),
        ('No ads, no selling', 'Khroga shows no ads and never sells or shares your data.'),
      ]);
}

class TermsScreen extends StatelessWidget {
  const TermsScreen({super.key});

  @override
  Widget build(BuildContext context) => const _TextPage(title: 'Terms of use', web: 'terms.html', sections: [
        ('Be kind', 'No harassment, hate, threats, spam or illegal content in groups and chats. Reported content may be removed and accounts may be blocked.'),
        ('Facts can change', 'Places, opening hours and other facts come from OpenStreetMap and Overture Maps and may be out of date. Check before you go.'),
        ('Your outings', 'Khroga suggests places; you decide where to go. Stay safe and respect places\' rules.'),
        ('Reviews', 'Review only places you really visited, and be honest and kind. No ads, links, phone numbers or other people\'s private details. Reviews are public with your name; reported reviews may be removed.'),
        ('AI-written text', 'When you turn on the AI, Google Gemini writes the plan\'s words. It can make mistakes; the places themselves always come from the map. Use "Report the AI-written text" if something is wrong or offensive.'),
        ('Free service', 'Khroga is free and offered as it is. Features may change.'),
      ]);
}

/// Send a note to the Khroga team (stored write-only in Firebase).
class FeedbackScreen extends ConsumerStatefulWidget {
  const FeedbackScreen({super.key});

  @override
  ConsumerState<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends ConsumerState<FeedbackScreen> {
  final _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final uid = ref.read(uidProvider);
    final text = _text.text.trim();
    if (uid == null || text.isEmpty) throw Exception(tr('Write a few words first.'));
    await ref.read(safetyRepositoryProvider).sendFeedback(by: uid, text: text, version: appVersion);
    if (!mounted) return;
    showMessage(context, tr('Thank you! We read every message, and many ideas end up in the app.'));
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return KScaffold(
      title: Text(tr('Report a problem or idea')),
      body: ListView(
        padding: const EdgeInsets.all(KSpace.lg),
        children: [
          Text(tr('Tell us what went wrong, or what you\'d love to see. Please don\'t include passwords or private details.')),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _text,
            maxLines: 6,
            maxLength: 1000,
            decoration: InputDecoration(hintText: tr('e.g. The map didn\'t open on my phone')),
          ),
          const SizedBox(height: KSpace.md),
          BusyButton(label: tr('Send'), icon: Icons.send, onPressed: _send),
        ],
      ),
    );
  }
}

/// People you blocked, with Unblock.
class BlockedScreen extends ConsumerWidget {
  const BlockedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final blocked = ref.watch(blockedUsersProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Blocked people'))),
      body: blocked.isEmpty
          ? EmptyState(
              emoji: '🙂',
              title: tr('Nobody is blocked'),
              message: tr('Long-press a chat message or open a friend to block someone.'),
            )
          : ListView(
              children: [
                for (final e in blocked.entries)
                  ListTile(
                    leading: const Icon(Icons.block),
                    title: Text(e.value),
                    trailing: TextButton(
                      onPressed: () => ref.read(blockedUsersProvider.notifier).set(e.key, null),
                      child: Text(tr('Unblock')),
                    ),
                  ),
              ],
            ),
    );
  }
}

/// Asks twice, then deletes everything and the sign-in itself.
Future<void> deleteMyAccount(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  final ok = await showDialog<bool>(
    context: context,
    builder: (d) => StatefulBuilder(
      builder: (d, setState) => AlertDialog(
        title: Text(tr('Delete your account?')),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(tr('This deletes your plans, favorites, notes, reviews and points, friends, check-ins and username. Groups you organize are deleted for everyone. This can\'t be undone.')),
            const SizedBox(height: KSpace.sm),
            Text(tr('Want a copy first? Use Profile → Export my data.'),
                style: Theme.of(d).textTheme.bodySmall),
            const SizedBox(height: KSpace.md),
            Text(tr('Type DELETE (or حذف) to confirm')),
            TextField(controller: controller, onChanged: (_) => setState(() {})),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr('Cancel'))),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(d).colorScheme.error),
            onPressed: const {'DELETE', 'حذف'}.contains(controller.text.trim().toUpperCase())
                ? () => Navigator.pop(d, true)
                : null,
            child: Text(tr('Delete forever')),
          ),
        ],
      ),
    ),
  );
  controller.dispose();
  if (ok != true || !context.mounted) return;
  final uid = ref.read(uidProvider);
  if (uid == null) return;
  final messenger = ScaffoldMessenger.of(context);
  final auth = ref.read(authRepositoryProvider);
  try {
    await auth.confirmIdentity(); // Google asks you to confirm it's you
    await ref.read(safetyRepositoryProvider).deleteAllData(uid,
        username: ref.read(myProfileProvider).value?.username);
    // Phone-only history goes too.
    ref.read(recentPlacesProvider.notifier).clear();
    ref.read(searchHistoryProvider.notifier).clear();
    ref.read(myRatingsProvider.notifier).clear();
    ref.read(planChecklistProvider.notifier).clear();
    await auth.deleteSignIn();
    messenger.showSnackBar(SnackBar(content: Text(tr('Your account was deleted.'))));
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(friendlyError(e))));
  }
}
