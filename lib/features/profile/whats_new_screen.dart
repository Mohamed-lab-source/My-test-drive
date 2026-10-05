import 'package:flutter/material.dart';

import '../../app/theme.dart';
import 'about_screen.dart' show appVersion;

/// The newest additions, in plain words.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({super.key});

  static const items = [
    ('🗳️', 'Group polls', 'Ask "Which place?" and everyone votes.'),
    ('😀', 'Reactions', 'Long-press a chat message to react or copy it.'),
    ('📌', 'Pinned note & meeting point', 'Organizers can pin a note and pick where everyone meets.'),
    ('📍', 'Plan around here', 'Plan an outing near a place, or near you.'),
    ('🛣️', 'Shortest route', 'Reorder a plan\'s stops so there\'s less driving.'),
    ('⏰', 'Edit times', 'Change when each stop starts, how long it lasts, and add notes.'),
    ('📋', 'Your lists', 'Make lists like "Birthday ideas" and add any place.'),
    ('⚖️', 'Compare places', 'See two places\' facts side by side.'),
    ('🏬', 'Mall floors', 'Mall directories grouped by floor, with search.'),
    ('🌑', 'Pure black & data saver', 'Darker dark mode, and an option to skip photos.'),
  ];

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: const Text("What's new")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Text('Version $appVersion', style: text.bodySmall),
          const SizedBox(height: KSpace.sm),
          for (final (emoji, title, body) in items)
            Card(
              child: ListTile(
                leading: Text(emoji, style: const TextStyle(fontSize: 26)),
                title: Text(title),
                subtitle: Text(body),
              ),
            ),
        ],
      ),
    );
  }
}
