/// Small pure helpers used across screens (tested in test/helpers_test.dart).
library;

import '../models/place.dart';

/// "Good evening, Mohamed" — from the phone's clock.
String greeting(int hour, String? name) {
  final part = hour < 5
      ? 'Up late'
      : hour < 12
          ? 'Good morning'
          : hour < 17
              ? 'Good afternoon'
              : 'Good evening';
  final first = name?.trim().split(RegExp(r'\s+')).first;
  return first == null || first.isEmpty ? part : '$part, $first';
}

/// "Today", "Yesterday", "Monday" (this week) or "3 Oct" — for chat dividers.
String chatDayLabel(DateTime d, DateTime now) {
  final day = DateTime(d.year, d.month, d.day);
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (diff > 1 && diff < 7) return weekdays[d.weekday - 1];
  return '${d.day} ${months[d.month - 1]}${d.year == now.year ? '' : ' ${d.year}'}';
}

bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

/// The next given weekday (1 = Monday … 7 = Sunday), today counts.
DateTime nextWeekday(DateTime now, int weekday) {
  final today = DateTime(now.year, now.month, now.day);
  return today.add(Duration(days: (weekday - now.weekday + 7) % 7));
}

/// Your own numbers, used for badges. All come from your account.
class MyCounts {
  const MyCounts({
    this.plans = 0,
    this.favorites = 0,
    this.visited = 0,
    this.groups = 0,
    this.friends = 0,
    this.visitedCategories = 0,
  });
  final int plans;
  final int favorites;
  final int visited;
  final int groups;
  final int friends;
  final int visitedCategories;
}

class Achievement {
  const Achievement(this.emoji, this.title, this.hint, {required this.earned});
  final String emoji;
  final String title;
  final String hint;
  final bool earned;
}

List<Achievement> badgesFor(MyCounts c) => [
      Achievement('🗺️', 'First plan', 'Make your first plan', earned: c.plans >= 1),
      Achievement('🧭', 'Planner', 'Make 10 plans', earned: c.plans >= 10),
      Achievement('❤️', 'Collector', 'Save 5 favorite places', earned: c.favorites >= 5),
      Achievement('✅', 'Out and about', "Mark 5 places you've been", earned: c.visited >= 5),
      Achievement('🏙️', 'City explorer', "Mark 25 places you've been", earned: c.visited >= 25),
      Achievement('🎨', 'All-rounder', 'Visit 5 different kinds of places', earned: c.visitedCategories >= 5),
      Achievement('👯', 'Organizer', 'Be in a group', earned: c.groups >= 1),
      Achievement('🤝', 'Social', 'Have 3 friends', earned: c.friends >= 3),
    ];

/// Waze's documented deep link, navigating to real coordinates.
Uri? wazeUrl(Place p) => p.hasLocation
    ? Uri.https('waze.com', '/ul', {'ll': '${p.lat},${p.lng}', 'navigate': 'yes'})
    : null;

/// A Google search for the place, so people can read reviews and see menus
/// there. We never copy or invent those ourselves.
Uri googleSearchUrl(Place p) => Uri.https('www.google.com', '/search', {
      'q': [p.name, p.area ?? '', p.city].where((s) => s.isNotEmpty).join(' '),
    });

/// The place's Wikidata page (which links to Wikipedia), when the map has it.
Uri? wikidataUrl(Place p) =>
    p.wikidata == null ? null : Uri.https('www.wikidata.org', '/wiki/${p.wikidata}');

/// A short chat message about a place, with a map link when we have one.
String placeChatText(Place p) => [
      '📍 ${p.name}${p.area == null ? '' : ' (${p.area})'}',
      if (p.hasLocation)
        Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': '${p.lat},${p.lng}'})
            .toString(),
    ].join('\n');

/// A chat message with a map link to where you are right now.
String myLocationText(double lat, double lng) =>
    "📍 I'm here: ${Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': '$lat,$lng'})}";
