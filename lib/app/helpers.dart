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

/// WhatsApp chat link for an Egyptian mobile number (01x…), else null.
/// It only opens a chat; it doesn't mean the place uses WhatsApp.
Uri? whatsappUrl(String? phone) {
  if (phone == null) return null;
  var d = phone.split(RegExp(r'[;,/]')).first.replaceAll(RegExp(r'[^0-9]'), '');
  if (d.startsWith('0020')) d = d.substring(2);
  if (d.startsWith('01') && d.length == 11) d = '20${d.substring(1)}';
  if (!(d.startsWith('201') && d.length == 12)) return null;
  return Uri.https('wa.me', '/$d');
}

/// Google Street View at the place's real coordinates.
Uri? streetViewUrl(Place p) => p.hasLocation
    ? Uri.https('www.google.com', '/maps/@', {
        'api': '1',
        'map_action': 'pano',
        'viewpoint': '${p.lat},${p.lng}',
      })
    : null;

/// A rough walking time for a straight-line distance (about 4.5 km/h).
int walkingMinutes(double km) => (km / 4.5 * 60).round().clamp(1, 100000);

/// Groups mall venues by floor ("Ground floor", "Floor 1"…), unknown last.
Map<String, List<Place>> byFloor(List<Place> venues) {
  double order(Place p) {
    final l = p.details.level?.split(';').first.trim();
    return double.tryParse(l ?? '') ?? 999;
  }

  final sorted = [...venues]..sort((a, b) => order(a).compareTo(order(b)));
  final out = <String, List<Place>>{};
  for (final v in sorted) {
    (out[v.details.floorLabel ?? 'Floor not listed'] ??= []).add(v);
  }
  return out;
}

/// A tip about using the app, a different one each day.
String tipOfTheDay(DateTime now) {
  const tips = [
    'Tap 🎲 in Explore when you can\'t decide.',
    'Long-press a chat message to copy it.',
    'Plan around any place: open it and tap "Plan around here".',
    'Tick stops off as you go on a plan.',
    'Turn on "Skip places I\'ve been" to discover somewhere new.',
    'Make lists like "Birthday ideas" from any place page.',
    'Compare two places side by side from a place page.',
    'Polls in a group help everyone pick a place fast.',
    'Data saver hides photos to save mobile data.',
  ];
  final dayOfYear = now.difference(DateTime(now.year)).inDays;
  return tips[dayOfYear % tips.length];
}

/// Simple yes/no/unknown text for comparing two places.
String factText(Object? v) => switch (v) {
      null => 'Unknown',
      true => 'Yes',
      false => 'No',
      'yes' => 'Yes',
      'no' => 'No',
      'limited' => 'Limited',
      _ => '$v',
    };

/// "just now", "5 min ago", "3 h ago", "2 days ago".
String timeAgo(DateTime t, DateTime now) {
  final d = now.difference(t);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes} min ago';
  if (d.inHours < 24) return '${d.inHours} h ago';
  return '${d.inDays} day${d.inDays == 1 ? '' : 's'} ago';
}

/// An OpenStreetMap "add a note" page at the place, to report a closed place
/// or a wrong fact. Volunteers fix the map; we never edit facts ourselves.
Uri? osmNoteUrl(Place p) => p.hasLocation
    ? Uri.parse('https://www.openstreetmap.org/note/new#map=19/${p.lat}/${p.lng}')
    : null;

/// Google Maps directions by public transport.
Uri? transitUrl(Place p) => p.hasLocation
    ? Uri.https('www.google.com', '/maps/dir/', {
        'api': '1',
        'destination': '${p.lat},${p.lng}',
        'travelmode': 'transit',
      })
    : null;

/// Just the domain of a website, e.g. "example.com".
String? websiteDomain(String? url) {
  if (url == null) return null;
  final u = Uri.tryParse(url.startsWith('http') ? url : 'https://$url');
  final host = u?.host ?? '';
  if (host.isEmpty) return null;
  return host.startsWith('www.') ? host.substring(4) : host;
}

/// Today's opening hours line, e.g. "10:00–23:00" or "Closed", or null.
String? todaysHours(Place p, DateTime now) {
  final table = p.hours?.weekTable();
  return table?[now.weekday - 1].$2;
}

/// Splits text into plain parts and web links, so links can be tapped.
List<(String, bool)> splitLinks(String text) {
  final re = RegExp(r'https?://[^\s]+');
  final out = <(String, bool)>[];
  var last = 0;
  for (final m in re.allMatches(text)) {
    if (m.start > last) out.add((text.substring(last, m.start), false));
    out.add((m.group(0)!, true));
    last = m.end;
  }
  if (last < text.length) out.add((text.substring(last), false));
  return out;
}

/// Total minutes spent at the stops (not counting travel).
int totalStopMinutes(Iterable<int?> durations) =>
    durations.fold(0, (sum, d) => sum + (d ?? 0));
