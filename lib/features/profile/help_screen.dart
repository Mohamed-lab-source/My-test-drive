import 'package:flutter/material.dart';
import '../../widgets/large_title.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/theme.dart';

/// Answers to the questions people ask most, in plain words.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  static const questions = [
    (
      '🗺️',
      'How does Khroga make a plan?',
      'Pick the vibe, people, time and area. The app picks real places from the map that fit, in a sensible order with times. Turn on "Let AI pick and write" for friendlier words.',
    ),
    (
      '✅',
      'Are the places real?',
      'Yes. Every place comes from OpenStreetMap or Overture Maps, never made up. When we don\'t know something (like hours), the app says it\'s unknown.',
    ),
    (
      '💵',
      'Why are there no prices?',
      'We never guess prices. The only money amounts you see are what Khroga users said they spent, in their reviews.',
    ),
    (
      '👥',
      'Where does "How busy is it now?" come from?',
      'From Khroga users at the place who tapped Quiet, Normal or Busy in the last 2 hours. No names are shown.',
    ),
    (
      '⏰',
      'How do reminders work?',
      'Open a plan or group outing and tap the bell. Your phone shows the reminder by itself, even offline. It can be a few minutes late.',
    ),
    (
      '🔓',
      'Do I need an account?',
      'No. Everything works as a guest. Reviews, friends and busy reports need a Google account, so people know they\'re real.',
    ),
    (
      '👯',
      'How do I plan with friends?',
      'Groups tab → New group → share the invite link or QR code. Chat, vote in polls, pick a day and send a plan to the group.',
    ),
    (
      '🏅',
      'How do points and badges work?',
      'Every review earns 10 points (20 if it\'s detailed). Points raise your guide level. Badges come from what you do: plans, places you\'ve been, friends and more.',
    ),
    (
      '📡',
      'Does it work without internet?',
      'Plans made by the app, saved places and the map you\'ve already seen work offline. Chat, reviews and weather need internet.',
    ),
    (
      '📍',
      'Why does Khroga ask for my location?',
      'Only for "Near me", distances and the map, and only when you tap them. Your location isn\'t saved unless you check in.',
    ),
    (
      '✏️',
      'A place is wrong or missing',
      'At the bottom of the place page, tap "Closed or wrong? Tell OpenStreetMap". The fix reaches Khroga with a later update.',
    ),
    (
      '🗑️',
      'How do I delete my data?',
      'Profile → Delete my account removes everything: plans, reviews, messages and your sign-in. You can export a copy first.',
    ),
    (
      '🧰',
      'What are the outing tools?',
      'Over 30 small helpers in Profile → Outing tools: decide for us, games, a score keeper, timers, tip and car-trip splits, qibla, Hijri date and more. Press and hold a tool to star it.',
    ),
    (
      '🏷️',
      'Can I label, pin or add notes to plans?',
      'Yes. Open a plan\'s menu (or "More" on the plan) for Label, Private note and Pin to the top. These stay on your phone only.',
    ),
    (
      '🔕',
      'Can I mute or pin a group?',
      'Press and hold a group in the Groups tab to pin it, mute it (no new-message dot) or give it your own emoji. Only on your phone.',
    ),
  ];

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final shown = [
      for (final q in HelpScreen.questions)
        if (_q.isEmpty || '${tr(q.$2)} ${tr(q.$3)}'.toLowerCase().contains(_q)) q,
    ];
    return KScaffold(
      title: Text(tr('Help & questions')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          TextField(
            decoration: InputDecoration(prefixIcon: const Icon(Icons.search), hintText: tr('Search help')),
            onChanged: (v) => setState(() => _q = v.trim().toLowerCase()),
          ),
          const SizedBox(height: KSpace.sm),
          for (final (emoji, q, a) in shown)
            Card(
              child: ExpansionTile(
                leading: Text(emoji, style: const TextStyle(fontSize: 22)),
                title: Text(tr(q)),
                shape: const Border(),
                childrenPadding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.md),
                expandedAlignment: Alignment.centerLeft,
                children: [Text(tr(a), style: text.bodyMedium)],
              ),
            ),
          if (shown.isEmpty)
            Padding(
              padding: const EdgeInsets.all(KSpace.lg),
              child: Text(tr('No answer found. Ask us below.'), textAlign: TextAlign.center),
            ),
          const SizedBox(height: KSpace.md),
          FilledButton.icon(
            onPressed: () => context.push('/feedback'),
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text(tr('Still stuck? Ask us')),
          ),
        ],
      ),
    );
  }
}
