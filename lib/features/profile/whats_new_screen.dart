import '../../app/i18n.dart';
import 'package:flutter/material.dart';

import '../../app/theme.dart';
import 'about_screen.dart' show appVersion;

/// The newest additions, in plain words.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({super.key});

  static const items = [
    ('🇪🇬', 'Arabic', 'The whole app in Arabic. Switch in Profile → Language.'),
    ('🗺️', 'Maps', 'See places, your plan\'s route and your friends on a map.'),
    ('📍', 'Check-ins', 'Tap "Check in" at a place. Friends see where you are for 24 hours.'),
    ('🔴', 'Unread chats', 'A dot shows groups with new messages.'),
    ('🎲', 'Surprise plan', 'One tap, a random vibe, a real plan.'),
    ('👤', 'Friend cards', 'Tap a friend to see their check-in or invite them to a group.'),
  ];

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(title: Text(tr("What's new"))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Text(trf('Version {v}', {'v': appVersion}), style: text.bodySmall),
          const SizedBox(height: KSpace.sm),
          for (final (emoji, title, body) in items)
            Card(
              child: ListTile(
                leading: Text(emoji, style: const TextStyle(fontSize: 26)),
                title: Text(tr(title)),
                subtitle: Text(tr(body)),
              ),
            ),
        ],
      ),
    );
  }
}
