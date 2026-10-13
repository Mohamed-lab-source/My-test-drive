/// Small pure helpers used across screens (tested in test/helpers_test.dart).
library;

import 'package:flutter/material.dart' show IconData, Icons;
import 'package:flutter/services.dart' show HapticFeedback;

import '../models/place.dart';
import 'i18n.dart';

/// "Good evening, Mohamed" — from the phone's clock.
String greeting(int hour, String? name) {
  final part = tr(hour < 5
      ? 'Up late'
      : hour < 12
          ? 'Good morning'
          : hour < 17
              ? 'Good afternoon'
              : 'Good evening');
  final first = name?.trim().split(RegExp(r'\s+')).first;
  return first == null || first.isEmpty ? part : '$part, $first';
}

/// "Today", "Yesterday", "Monday" (this week) or "3 Oct" — for chat dividers.
String chatDayLabel(DateTime d, DateTime now) {
  final day = DateTime(d.year, d.month, d.day);
  final today = DateTime(now.year, now.month, now.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return tr('Today');
  if (diff == 1) return tr('Yesterday');
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (diff > 1 && diff < 7) return tr(weekdays[d.weekday - 1]);
  return '${d.day} ${tr(months[d.month - 1])}${d.year == now.year ? '' : ' ${d.year}'}';
}

bool sameDay(DateTime a, DateTime b) => a.year == b.year && a.month == b.month && a.day == b.day;

/// The next given weekday (1 = Monday … 7 = Sunday), today counts.
DateTime nextWeekday(DateTime now, int weekday) {
  final today = DateTime(now.year, now.month, now.day);
  return today.add(Duration(days: (weekday - now.weekday + 7) % 7));
}

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
    (out[v.details.floorLabel ?? tr('Floor not listed')] ??= []).add(v);
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
  return tr(tips[dayOfYear % tips.length]);
}

/// Simple yes/no/unknown text for comparing two places.
String factText(Object? v) => switch (v) {
      null => tr('Unknown'),
      true => tr('Yes'),
      false => tr('No'),
      'yes' => tr('Yes'),
      'no' => tr('No'),
      'limited' => tr('Limited'),
      _ => '$v',
    };

/// "just now", "5 min ago", "3 h ago", "2 days ago".
String timeAgo(DateTime t, DateTime now) {
  final d = now.difference(t);
  if (d.inMinutes < 1) return tr('just now');
  if (d.inMinutes < 60) return trf('{n} min ago', {'n': d.inMinutes});
  if (d.inHours < 24) return trf('{n} h ago', {'n': d.inHours});
  return d.inDays == 1 ? tr('1 day ago') : trf('{n} days ago', {'n': d.inDays});
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

/// "18:30" → "6:30 PM" when the 24-hour clock is off. Unknown stays as is.
String showTime(String? hhmm, {bool clock24 = true}) {
  if (hhmm == null) return '';
  final parts = hhmm.split(':');
  if (clock24 || parts.length != 2) return hhmm;
  final h = int.tryParse(parts[0]);
  if (h == null) return hhmm;
  final suffix = h < 12 ? tr('AM') : tr('PM');
  final h12 = h % 12 == 0 ? 12 : h % 12;
  return '$h12:${parts[1]} $suffix';
}

/// Arabic search: treats أ/إ/آ as ا, ة as ه, ى as ي, and ignores tashkeel;
/// English: lowercase. So "القاهره" finds "القاهرة".
String normalizeSearch(String s) => s
    .toLowerCase()
    .replaceAll(RegExp('[أإآ]'), 'ا')
    .replaceAll('ة', 'ه')
    .replaceAll('ى', 'ي')
    .replaceAll(RegExp('[ً-ْـ]'), '')
    .trim();

/// True for messages made only of a few emoji (shown bigger in chat).
bool isOnlyEmoji(String text) {
  final t = text.replaceAll(RegExp(r'\s'), '');
  if (t.isEmpty || t.runes.length > 8) return false;
  return !RegExp(r'[A-Za-z0-9؀-ۿ]').hasMatch(t);
}

/// Haptic tap, when the person has it on.
void tapFeedback(bool enabled) {
  if (enabled) HapticFeedback.selectionClick();
}

/// A bill total from the amount the person typed (we never guess prices):
/// service is added first, VAT is charged on food + service (as Egyptian
/// bills do), and the tip is a % of the typed amount.
double billTotal(double amount, {num servicePct = 0, num vatPct = 0, num tipPct = 0}) =>
    amount * (1 + servicePct / 100) * (1 + vatPct / 100) + amount * tipPct / 100;

/// A general, honest tip for a kind of place (no made-up facts about it).
String? categoryTip(String category) => switch (category) {
      'cinema' => tr('Check showtimes on the cinema\'s website or app before you go.'),
      'museum' => tr('Museums often close early and may need a ticket. Check before you go.'),
      'park' => tr('Parks are nicest before sunset. Bring water.'),
      'escape_room' => tr('Escape rooms usually need booking ahead.'),
      'sight' => tr('Some sights need a ticket and close early. Check before you go.'),
      'mall' => tr('Malls get busy on Thursday and Friday evenings.'),
      _ => null,
    };

/// Opens any installed map app at the place (Android "geo:" link).
Uri? geoUrl(Place p) => p.hasLocation
    ? Uri.parse('geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${Uri.encodeComponent(p.name)})')
    : null;

/// A Google Calendar link for visiting one place at [when] (1.5 hours).
Uri visitCalendarUrl(Place p, DateTime when) {
  String fmt(DateTime d) {
    final u = d.toUtc();
    String two(int n) => n.toString().padLeft(2, '0');
    return '${u.year}${two(u.month)}${two(u.day)}T${two(u.hour)}${two(u.minute)}00Z';
  }

  return Uri.https('calendar.google.com', '/calendar/render', {
    'action': 'TEMPLATE',
    'text': p.name,
    'dates': '${fmt(when)}/${fmt(when.add(const Duration(minutes: 90)))}',
    'location': [p.name, ?p.address, ?p.area].join(', '),
    'details': tr('Planned with Khroga'),
  });
}

/// Everything we know about a place as plain text (for "Copy all info").
String placeInfoText(Place p) => [
      p.shownName,
      [p.kindLabel ?? Categories.label(p.category), ?p.area].join(' · '),
      ?p.address,
      ?p.phone,
      ?p.website,
      if (p.openingHours != null) '${tr('Opening hours')}: ${p.openingHours}',
      if (p.hasLocation)
        Uri.https('www.google.com', '/maps/search/', {'api': '1', 'query': '${p.lat},${p.lng}'}).toString(),
    ].join('\n');

/// When the bundled place data was built (set by the GitHub build).
const buildDate = String.fromEnvironment('BUILD_DATE');

/// A weather icon that matches the forecast text we wrote.
IconData weatherIcon(String note) {
  final n = note.toLowerCase();
  if (n.contains('rain likely') || note.contains('هتمطر')) return Icons.umbrella_outlined;
  if (RegExp(r'(3[5-9]|4\d)°').hasMatch(note)) return Icons.thermostat;
  return Icons.wb_sunny_outlined;
}
