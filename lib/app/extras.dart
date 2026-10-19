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

/// The sun's declination (radians) and the equation of time (minutes) for a
/// day: the two numbers every sun-time formula below needs (NOAA).
(double, double) _sunPosition(DateTime day) {
  final n = DateTime.utc(day.year, day.month, day.day).difference(DateTime.utc(day.year)).inDays + 1;
  final g = 2 * math.pi / 365 * (n - 1);
  final eqTime = 229.18 *
      (0.000075 + 0.001868 * math.cos(g) - 0.032077 * math.sin(g) -
          0.014615 * math.cos(2 * g) - 0.040849 * math.sin(2 * g));
  final decl = 0.006918 - 0.399912 * math.cos(g) + 0.070257 * math.sin(g) -
      0.006758 * math.cos(2 * g) + 0.000907 * math.sin(2 * g) -
      0.002697 * math.cos(3 * g) + 0.00148 * math.sin(3 * g);
  return (decl, eqTime);
}

/// Minutes from solar noon until the sun is at [altitude] degrees (negative
/// = below the horizon). Null if it never gets there that day.
double? _minutesFromNoon(double altitude, double lat, double decl) {
  double rad(double d) => d * math.pi / 180;
  final cosH = (math.sin(rad(altitude)) - math.sin(rad(lat)) * math.sin(decl)) /
      (math.cos(rad(lat)) * math.cos(decl));
  if (cosH.abs() > 1) return null;
  return 4 * math.acos(cosH) * 180 / math.pi;
}

/// Prayer times (UTC) by the Egyptian General Authority of Survey method
/// (Fajr at 19.5°, Isha at 17.5°, Asr with shadow factor 1). Worked out from
/// the date and place, so a mosque's own timetable may differ by a minute
/// or two.
({DateTime fajr, DateTime sunrise, DateTime dhuhr, DateTime asr, DateTime maghrib, DateTime isha})?
    prayerTimes(DateTime day, double lat, double lng) {
  final (decl, eqTime) = _sunPosition(day);
  final noon = 720 - 4 * lng - eqTime;
  final fajr = _minutesFromNoon(-19.5, lat, decl);
  final rise = _minutesFromNoon(-0.833, lat, decl);
  final isha = _minutesFromNoon(-17.5, lat, decl);
  final asrAlt = math.atan(1 / (1 + math.tan((lat * math.pi / 180 - decl).abs()))) * 180 / math.pi;
  final asr = _minutesFromNoon(asrAlt, lat, decl);
  if (fajr == null || rise == null || isha == null || asr == null) return null;
  final base = DateTime.utc(day.year, day.month, day.day);
  DateTime at(double m) => base.add(Duration(seconds: (m * 60).round()));
  return (
    fajr: at(noon - fajr),
    sunrise: at(noon - rise),
    dhuhr: at(noon + 1),
    asr: at(noon + asr),
    maghrib: at(noon + rise),
    isha: at(noon + isha),
  );
}

/// Prayers that fall between [start] and [end] ("HH:mm", phone time) on
/// [day], e.g. [('Maghrib', '17:32')]. Handy for planning a break.
List<(String, String)> prayersDuring(DateTime day, String start, String end, double lat, double lng) {
  final t = prayerTimes(day, lat, lng);
  int? mins(String hhmm) {
    final p = hhmm.split(':');
    return p.length == 2 ? (int.tryParse(p[0]) ?? 0) * 60 + (int.tryParse(p[1]) ?? 0) : null;
  }

  final a = mins(start), b = mins(end);
  if (t == null || a == null || b == null) return const [];
  final out = <(String, String)>[];
  for (final (name, time) in [
    ('Dhuhr', t.dhuhr),
    ('Asr', t.asr),
    ('Maghrib', t.maghrib),
    ('Isha', t.isha),
  ]) {
    final local = hhmmLocal(time);
    final m = mins(local)!;
    if (m >= a && m <= (b < a ? b + 24 * 60 : b)) out.add((tr(name), local));
  }
  return out;
}

/// One day's forecast from Open-Meteo.
typedef DayForecast = ({DateTime day, double maxC, int rainPct});

/// Reads Open-Meteo's daily answer (dates, max temperature, rain chance).
List<DayForecast> parseWeek(Map<String, dynamic> json) {
  final daily = json['daily'] as Map?;
  final days = (daily?['time'] as List?) ?? const [];
  final temps = (daily?['temperature_2m_max'] as List?) ?? const [];
  final rain = (daily?['precipitation_probability_max'] as List?) ?? const [];
  return [
    for (var i = 0; i < days.length && i < temps.length; i++)
      if (DateTime.tryParse('${days[i]}') case final d? when temps[i] is num)
        (
          day: d,
          maxC: (temps[i] as num).toDouble(),
          rainPct: i < rain.length && rain[i] is num ? (rain[i] as num).round() : 0,
        ),
  ];
}

/// The most comfortable day for going out: least rain, then closest to 26°C.
DayForecast? bestDay(List<DayForecast> week) {
  if (week.isEmpty) return null;
  double cost(DayForecast d) => d.rainPct * 0.5 + (d.maxC - 26).abs();
  return week.reduce((a, b) => cost(b) < cost(a) ? b : a);
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
      {this.people = 2, this.needs = const []});

  /// Must-haves (see planNeeds in planner.dart), judged from map facts.
  final List<String> needs;
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
  OutingIdea('🌙', 'After iftar', 'Food and a late sit-down after sunset.', ['foodie', 'chill'], 'night', 2, people: 4),
  OutingIdea('🌧️', 'Rainy or hot day', 'Indoor places only: malls and culture.', ['shopping', 'culture'], 'afternoon', 3),
  OutingIdea('💻', 'Work from a café', 'Cafés whose map entry lists Wi-Fi.', ['chill'], 'morning', 1, people: 1, needs: ['wifi']),
  OutingIdea('♿', 'Step-free outing', 'Only places mapped with wheelchair access.', ['chill', 'culture'], 'afternoon', 2, needs: ['wheelchair']),
  OutingIdea('🥗', 'Veggie food tour', 'Food places mapped with vegetarian options.', ['foodie'], 'evening', 2, needs: ['vegetarian']),
  OutingIdea('🚭', 'Smoke-free evening', 'Places mapped as no smoking.', ['chill', 'foodie'], 'evening', 2, needs: ['noSmoking']),
];

/// A random item, or null for an empty list.
T? randomOf<T>(List<T> items, math.Random random) =>
    items.isEmpty ? null : items[random.nextInt(items.length)];

final _link = RegExp(r'(https?://|www\.|\.com\b|\.net\b)', caseSensitive: false);
final _phone = RegExp(r'[0-9٠-٩][0-9٠-٩ -]{7,}[0-9٠-٩]');

/// Words we don't allow in public reviews (checked word by word, so normal
/// words that merely contain them are fine).
const _blockedWords = {
  'fuck', 'fucking', 'shit', 'bitch', 'asshole', 'bastard', 'slut', 'whore', 'dick', 'cunt',
  'شرموط', 'شرموطة', 'متناك', 'خول', 'عرص', 'وسخة', 'كسمك', 'منيوك', 'زبي',
};

/// Why a review text can't be posted, or null when it's fine: no links,
/// no phone numbers, no rude words.
String? reviewTextProblem(String text) {
  if (_link.hasMatch(text)) return tr('Please remove links from your review.');
  if (_phone.hasMatch(text)) return tr('Please remove phone numbers from your review.');
  final words = text.toLowerCase().split(RegExp(r'[^\p{L}]+', unicode: true));
  if (words.any(_blockedWords.contains)) return tr('Please keep it kind: remove rude words.');
  return null;
}

/// The outing idea that suits right now (day, time, weather), as an index
/// into [outingIdeas]. Only fills in the form; places are still real.
int ideaForNow(DateTime now, {double? maxTempC, int? rainPct}) {
  int idx(String title) => outingIdeas.indexWhere((i) => i._title == title);
  final weekend = isEgyptWeekend(now);
  final h = now.hour;
  if ((maxTempC ?? 0) >= 36 || (rainPct ?? 0) >= 50) return idx('Rainy or hot day');
  if (h >= 21 || h < 4) return idx(weekend ? 'Night out' : 'Friends catch-up');
  if (h < 11) return idx(weekend ? 'Culture morning' : 'Coffee and a walk');
  if (h < 16) return idx(weekend ? 'Family day' : 'Coffee and a walk');
  return idx(weekend ? 'Friends catch-up' : 'Date night');
}

/// Whether the sun is up at [now] at a real spot (from [sunTimes]).
bool isDaytime(DateTime now, double lat, double lng) {
  final s = sunTimes(now, lat, lng);
  if (s == null) return true;
  final t = now.toUtc();
  return t.isAfter(s.sunrise) && t.isBefore(s.sunset);
}
