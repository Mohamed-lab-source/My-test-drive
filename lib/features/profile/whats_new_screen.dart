import '../../app/i18n.dart';
import 'package:flutter/material.dart';

import '../../app/theme.dart';
import 'about_screen.dart' show appVersion;

/// The newest additions, in plain words.
class WhatsNewScreen extends StatelessWidget {
  const WhatsNewScreen({super.key});

  static const items = [
    ('🎁', 'Send a surprise', 'Share a plan as a mystery: your friend reveals it stop by stop.'),
    ('☔', 'Indoor backup', 'Rain or heat? Swap outdoor stops for real indoor places nearby.'),
    ('🚗', 'When should I leave?', 'A rough leave-by time from where you are to the first stop.'),
    ('🛟', 'Share with someone I trust', 'Send your plan and when you\'ll be done, for peace of mind.'),
    ('🧭', 'Around here', 'Wikipedia articles and photos people took near a place.'),
    ('📔', 'My timeline', 'Every place you\'ve been, by date, with a 12-week activity grid.'),
    ('📸', 'Memories', '"A month ago today you were at…" on the Plan tab.'),
    ('👤', 'Profiles', 'Tap a friend or a reviewer to see their level and newest reviews.'),
    ('⭐', 'Sort reviews', 'Newest, highest or lowest, or only reviews with words.'),
    ('✨', 'Daily place idea', 'An optional 10:00 notification with the place of the day.'),
    ('🆘', 'Emergency numbers', 'Police, ambulance, fire and tourist police, one tap away in Tools.'),
    ('🗣️', 'Arabic phrases', 'Everyday Egyptian Arabic for visitors, in Tools.'),
    ('📱', 'App shortcuts', 'Press and hold the Khroga icon for a new plan, Explore and more.'),
    ('⏰', 'Outing reminders', 'Tap the bell on a plan or group outing and your phone reminds you before it starts.'),
    ('👥', 'How busy is it now?', 'People at a place say Quiet, Normal or Busy, so you know before you go.'),
    ('💵', 'Real prices from people', 'Reviews can say what you spent per person. Place pages show what most people spent.'),
    ('❓', 'Help & questions', 'Plain answers to common questions, in Profile.'),
    ('🏅', '32 badges', 'Badges with progress bars, and confetti when you earn one.'),
    ('🎉', 'My recap', 'Your month or year on Khroga as a story picture, plus your outing personality.'),
    ('🎯', 'Monthly bingo', '9 kinds of places to try this month, and your own goal.'),
    ('✨', 'Place of the day', 'One real place in your city every day, the same for everyone.'),
    ('🗂️', 'Collections', 'Work spots, open late, wheelchair friendly, kids areas and more, from the map.'),
    ('🏆', 'Friends leaderboard', 'See who has the most guide points among your friends.'),
    ('🎁', 'Mystery mode', 'Reveal a plan one stop at a time. Great for dates and surprises.'),
    ('🍀', 'Feeling lucky', 'A random real place in Explore.'),
    ('🗺️', 'Area explorer', 'See how many areas you\'ve explored.'),
    ('📅', 'Quick polls', '"Which day?", "What time?" and "What vibe?" polls in groups with one tap.'),
    ('🎲', 'Party tools', 'Make teams, roll dice and get conversation starters.'),
    ('📖', 'Wikipedia on place pages', 'Famous places show a short summary from Wikipedia, with a link.'),
    ('🌤️', 'Weather at every stop', 'Plans show the forecast for the hour you\'ll be at each place.'),
    ('☀️', 'UV and air quality', 'Today\'s UV and air quality for your city on the Plan tab.'),
    ('⭐', 'Top on Khroga', 'The best-rated places in your city and the newest reviews.'),
    ('🏆', 'Weekly challenges', 'A new small goal every Saturday.'),
    ('📸', 'More real facts', 'Instagram, Facebook and menu links, kids areas and halal tags, when the maps list them.'),
    ('✍️', 'Reviews', 'Rate places, answer quick questions about them and read what other Khroga users say.'),
    ('🏅', 'Guide levels', 'Every review earns points: grow from Newcomer to Local Guide, Advanced Guide and more.'),
    ('🍽️', 'Expert badges', 'Review lots of one kind of place to become a Food, Café, Culture or Fun expert.'),
    ('🔗', 'Links that open Khroga', 'Share a plan, a place, a group invite or "add me" as a link. Friends tap it and it opens in the app.'),
    ('📸', 'Share as a picture', 'Send a plan, a place or your numbers as a story-size picture.'),
    ('💾', 'Save a friend\'s plan', 'Open a shared plan and save it to your plans with one tap.'),
    ('⭐', 'Rate Khroga', 'A good rating helps more people find it.'),
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
