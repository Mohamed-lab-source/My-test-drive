import '../../app/i18n.dart';
import 'package:flutter/material.dart';

import '../../app/theme.dart';
import 'about_screen.dart' show appVersion;

/// The newest additions, in plain words.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({super.key});

  static const items = [
    ('💡', 'Outing ideas', '18 ready-made outings, from date night to a step-free day.'),
    ('🏘️', 'Areas', 'Every neighbourhood with its places, a map and "Plan an outing here".'),
    ('✅', 'Must-haves', 'Plan only with places mapped with wheelchair access, Wi-Fi, no smoking and more.'),
    ('🌤️', 'Weather this week', 'The real forecast and the most comfortable day to go out.'),
    ('🕌', 'Prayer times and sunset', 'Worked out for your city, and shown during your plans.'),
    ('🧰', 'Outing tools', 'Decide for us, flip a coin, who pays, split a bill, holidays.'),
    ('📊', 'Your numbers', 'Streaks, top areas, your map and all your notes in one place.'),
    ('⭐', 'Your own presets', 'Save your usual choices and plan with one tap.'),
    ('🔎', 'Forgiving search', 'A typo or Arabic numbers still find the place.'),
    ('🅱️', 'Bold text', 'An easier-to-read option in Profile.'),
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
