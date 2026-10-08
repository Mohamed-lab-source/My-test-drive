/// More small pure helpers (tested in test/extras_test.dart). Everything here
/// is either maths (sunset, distance, direction) or fixed public facts
/// (Egypt's fixed-date public holidays). Nothing about places is invented.
library;

import 'dart:math' as math;

import '../models/place.dart';
import 'i18n.dart';

/// Sunrise and sunset (UTC) for a day at a real spot, using NOAA's simple
/// solar formula (accurate to a couple of minutes). Null near the poles.
({DateTime sunrise, DateTime sunset})? sunTimes(DateTime day, double lat, double lng) {
  double rad(double d) => d * math.pi / 180;
  double deg(double r) => r * 180 / math.pi;
  final n = DateTime.utc(day.year, day.month, day.day)
          .difference(DateTime.utc(day.year))
          .inDays +
      1;
  final g = 2 * math.pi / 365 * (n - 1);
  final eqTime = 229.18 *
      (0.000075 +
          0.001868 * math.cos(g) -
          0.032077 * math.sin(g) -
          0.014615 * math.cos(2 * g) -
          0.040849 * math.sin(2 * g));
  final decl = 0.006918 -
      0.399912 * math.cos(g) +
      0.070257 * math.sin(g) -
      0.006758 * math.cos(2 * g) +
      0.000907 * math.sin(2 * g) -
      0.002697 * math.cos(3 * g) +
      0.00148 * math.sin(3 * g);
  final cosHa = math.cos(rad(90.833)) / (math.cos(rad(lat)) * math.cos(decl)) -
      math.tan(rad(lat)) * math.tan(decl);
  if (cosHa.abs() > 1) return null;
  final ha = deg(math.acos(cosHa));
  final base = DateTime.utc(day.year, day.month, day.day);
  Duration mins(double m) => Duration(seconds: (m * 60).round());
  return (
    sunrise: base.add(mins(720 - 4 * (lng + ha) - eqTime)),
    sunset: base.add(mins(720 - 4 * (lng - ha) - eqTime)),
  );
}

/// The middle of each city, for sunset times when we have no exact spot.
const cityCenters = <String, (double, double)>{
  'cairo': (30.0444, 31.2357),
  'giza': (30.0131, 31.2089),
  'alexandria': (31.2001, 29.9187),
};

/// "17:32" from a time, in the phone's own time zone.
String hhmmLocal(DateTime t) {
  final l = t.toLocal();
  return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
}

/// Egypt's fixed-date public holidays. Islamic holidays follow the moon and
/// are announced each year, so we don't list them (no guessing).
const _egyptHolidays = <(int, int), String>{
  (1, 7): 'Coptic Christmas',
  (1, 25): 'Revolution Day (25 January)',
  (4, 25): 'Sinai Liberation Day',
  (5, 1): 'Labour Day',
  (6, 30): 'June 30 Revolution Day',
  (7, 23): 'Revolution Day (23 July)',
  (10, 6): 'Armed Forces Day',
};

/// The fixed public holiday on [day], or null. (The government sometimes
/// moves a holiday to a Thursday; we say so where it's shown.)
String? egyptHoliday(DateTime day) {
  final name = _egyptHolidays[(day.month, day.day)];
  return name == null ? null : tr(name);
}

/// All fixed holidays of a year, in order.
List<(DateTime, String)> egyptHolidaysOf(int year) => [
      for (final e in _egyptHolidays.entries) (DateTime(year, e.key.$1, e.key.$2), tr(e.value)),
    ]..sort((a, b) => a.$1.compareTo(b.$1));

/// Friday and Saturday are the weekend in Egypt.
bool isEgyptWeekend(DateTime day) =>
    day.weekday == DateTime.friday || day.weekday == DateTime.saturday;

/// "350 m" or "2.4 km".
String distanceText(double km) => km < 1
    ? trf('{n} m', {'n': ((km * 1000) / 10).round() * 10})
    : trf('{n} km', {'n': km < 10 ? km.toStringAsFixed(1) : km.round()});

/// Which way to go, e.g. "north-east", from one real spot to another.
String compassDirection(double fromLat, double fromLng, double toLat, double toLng) {
  double rad(double d) => d * math.pi / 180;
  final y = math.sin(rad(toLng - fromLng)) * math.cos(rad(toLat));
  final x = math.cos(rad(fromLat)) * math.sin(rad(toLat)) -
      math.sin(rad(fromLat)) * math.cos(rad(toLat)) * math.cos(rad(toLng - fromLng));
  final bearing = (math.atan2(y, x) * 180 / math.pi + 360) % 360;
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return tr(names[((bearing + 22.5) % 360 ~/ 45)]);
}

/// "1 h 30 min", "45 min", "2 h".
String durationText(int minutes) {
  if (minutes < 60) return trf('{n} min', {'n': minutes});
  final h = minutes ~/ 60, m = minutes % 60;
  return m == 0 ? trf('{h} h', {'h': h}) : trf('{h} h {m} min', {'h': h, 'm': m});
}

/// "today", "tomorrow", "in 5 days", or null when it's in the past.
String? daysUntilText(DateTime day, DateTime now) {
  final d = DateTime(day.year, day.month, day.day)
      .difference(DateTime(now.year, now.month, now.day))
      .inDays;
  if (d < 0) return null;
  if (d == 0) return tr('today');
  if (d == 1) return tr('tomorrow');
  return trf('in {n} days', {'n': d});
}

/// "a, b and c" (in Arabic "a، b و c").
String readableList(List<String> items) {
  if (items.isEmpty) return '';
  if (items.length == 1) return items.first;
  final sep = isArabic ? '، ' : ', ';
  return '${items.sublist(0, items.length - 1).join(sep)} ${tr('and')} ${items.last}';
}

/// ٠١٢ → 012 and ۰۱۲ → 012, so numbers typed on an Arabic keyboard work.
String latinDigits(String s) => s.replaceAllMapped(RegExp('[٠-٩۰-۹]'), (m) {
      final c = m.group(0)!.codeUnitAt(0);
      return '${c >= 0x06F0 ? c - 0x06F0 : c - 0x0660}';
    });

/// Edit distance, capped (stops early once it's over [max]).
int editDistance(String a, String b, {int max = 3}) {
  if ((a.length - b.length).abs() > max) return max + 1;
  var prev = List<int>.generate(b.length + 1, (i) => i);
  for (var i = 1; i <= a.length; i++) {
    final cur = List<int>.filled(b.length + 1, 0)..[0] = i;
    var rowMin = cur[0];
    for (var j = 1; j <= b.length; j++) {
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      cur[j] = math.min(math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
      rowMin = math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/// Forgiving search: every typed word must appear in [text], or (for words of
/// 4+ letters) be one typo away from a word in it. Both sides should already
/// be normalized (see normalizeSearch).
bool fuzzyContains(String text, String query) {
  final words = query.split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  if (words.isEmpty) return true;
  final textWords = text.split(RegExp(r'[\s,.\-()]+'));
  for (final w in words) {
    if (text.contains(w)) continue;
    if (w.length < 4) return false;
    bool near(String t) =>
        editDistance(t, w, max: 1) <= 1 ||
        (t.length > w.length && editDistance(t.substring(0, w.length), w, max: 1) <= 1);
    if (!textWords.any(near)) {
      return false;
    }
  }
  return true;
}

/// Counts of [items] by [key], biggest first.
List<(String, int)> countBy<T>(Iterable<T> items, String? Function(T) key) {
  final m = <String, int>{};
  for (final i in items) {
    final k = key(i);
    if (k == null || k.isEmpty) continue;
    m[k] = (m[k] ?? 0) + 1;
  }
  return m.entries.map((e) => (e.key, e.value)).toList()
    ..sort((a, b) => b.$2 != a.$2 ? b.$2.compareTo(a.$2) : a.$1.compareTo(b.$1));
}

/// How many weeks in a row (ending this week or last week) have at least one
/// of [dates]. Used for your planning streak.
int weekStreak(Iterable<DateTime> dates, DateTime now) {
  int weekIndex(DateTime d) =>
      DateTime.utc(d.year, d.month, d.day).difference(DateTime.utc(2000, 1, 3)).inDays ~/ 7;
  final weeks = dates.map(weekIndex).toSet();
  var w = weekIndex(now);
  if (!weeks.contains(w)) w--;
  var streak = 0;
  while (weeks.contains(w)) {
    streak++;
    w--;
  }
  return streak;
}

/// Up to two letters for an avatar, e.g. "Mohamed Ali" → "MA".
String initialsOf(String? name) {
  final parts = (name ?? '').trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.isEmpty) return '?';
  final a = String.fromCharCode(parts.first.runes.first);
  final b = parts.length > 1 ? String.fromCharCode(parts.last.runes.first) : '';
  return (a + b).toUpperCase();
}

/// Places in [area] of [city], best documented first (quality only ranks).
List<Place> placesInArea(List<Place> all, String city, String area) => all
    .where((p) => p.city == city && p.area == area && p.parentMallId == null)
    .toList()
  ..sort((a, b) => b.quality.compareTo(a.quality));

/// The middle of some places (for "Plan here" on an area page).
(double, double)? centerOf(Iterable<Place> places) {
  final located = places.where((p) => p.hasLocation).toList();
  if (located.isEmpty) return null;
  return (
    located.map((p) => p.lat!).reduce((a, b) => a + b) / located.length,
    located.map((p) => p.lng!).reduce((a, b) => a + b) / located.length,
  );
}

/// A ready-made outing idea: it only fills in the plan form.
class OutingIdea {
  const OutingIdea(this.emoji, this._title, this._blurb, this.vibes, this.time, this.stops,
      {this.people = 2});
  final String emoji;
  final String _title;
  final String _blurb;
  String get title => tr(_title);
  String get blurb => tr(_blurb);
  final List<String> vibes;
  final String time;
  final int stops;
  final int people;
}

const outingIdeas = [
  OutingIdea('💕', 'Date night', 'Dinner and a calm place to talk.', ['romantic', 'foodie'], 'evening', 2),
  OutingIdea('☕', 'Coffee and a walk', 'A café, then somewhere green.', ['chill'], 'afternoon', 2),
  OutingIdea('👨‍👩‍👧', 'Family day', 'Easy places for all ages.', ['family'], 'afternoon', 3, people: 4),
  OutingIdea('🏛️', 'Culture morning', 'Museums and sights before it gets hot.', ['culture'], 'morning', 3),
  OutingIdea('🍕', 'Food tour', 'Three food stops close together.', ['foodie'], 'evening', 3, people: 3),
  OutingIdea('⚡', 'Get moving', 'Games, activities and fun.', ['active'], 'afternoon', 3, people: 4),
  OutingIdea('🛍️', 'Shopping trip', 'Malls and shops, with a break.', ['shopping', 'chill'], 'afternoon', 3),
  OutingIdea('🌙', 'Night out', 'Late places for the whole gang.', ['nightlife', 'foodie'], 'night', 3, people: 5),
  OutingIdea('🎂', 'Birthday outing', 'Food, fun and something sweet.', ['foodie', 'active'], 'evening', 3, people: 6),
  OutingIdea('🧘', 'Me time', 'A quiet solo outing.', ['chill', 'culture'], 'morning', 2, people: 1),
  OutingIdea('👯', 'Friends catch-up', 'Somewhere to sit and talk for hours.', ['chill', 'foodie'], 'evening', 2, people: 4),
  OutingIdea('🌅', 'Sunset plan', 'Outside before sunset, food after.', ['chill', 'romantic'], 'afternoon', 2),
];

/// A random item, or null for an empty list.
T? randomOf<T>(List<T> items, math.Random random) =>
    items.isEmpty ? null : items[random.nextInt(items.length)];
