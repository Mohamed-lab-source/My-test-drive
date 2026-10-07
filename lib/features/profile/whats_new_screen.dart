import '../../app/i18n.dart';
import 'package:flutter/material.dart';

import '../../app/theme.dart';
import 'about_screen.dart' show appVersion;

/// The newest additions, in plain words.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({super.key});

  static const items = [
    ('🛡️', 'Safety', 'Report or block people, delete your account, privacy policy and terms.'),
    ('💬', 'Better chats', 'Reply to messages, delete your own, big emoji, jump to newest.'),
    ('🗳️', 'Poll results', 'Bars and the names of who voted for what.'),
    ('💸', 'Bill splitter', 'Add 12% service and 14% VAT, then send the result to the chat.'),
    ('⏰', 'Plan timing', 'Start now, shift all times, and see if each stop is open then.'),
    ('🚶', 'Walking times', 'Short hops show how many minutes on foot.'),
    ('🔎', 'Smarter search', 'Arabic spelling differences no longer matter.'),
    ('🎨', 'New colors', 'Teal and Indigo themes, huge text, 12-hour clock.'),
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
