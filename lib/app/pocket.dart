/// Version 2.0 "pocket" extras: small calculations and lists that run on the
/// phone only (no Firestore reads or writes). Tested in test/pocket_test.dart.
library;

import 'dart:convert';
import 'dart:math' as math;

import '../models/plan.dart';
import '../planner/planner.dart' show planEndTime;
import 'extras.dart' show sunTimes;
import 'helpers.dart' show normalizeSearch;
import 'i18n.dart';

// ---------------------------------------------------------------- money math

/// Tip on a bill the people typed, split evenly. Only their numbers.
({double tip, double total, double each}) tipShare(double bill, double percent, int people) {
  final tip = bill * percent / 100;
  final total = bill + tip;
  return (tip: tip, total: total, each: people <= 0 ? total : total / people);
}

/// Fuel for a car trip, from the car's own numbers (km, litres per 100 km,
/// price per litre), plus parking/tolls, split between the riders.
({double litres, double cost, double each}) carSplit({
  required double km,
  required double litresPer100,
  required double pricePerLitre,
  required int people,
  double extra = 0,
}) {
  final litres = km * litresPer100 / 100;
  final cost = litres * pricePerLitre + extra;
  return (litres: litres, cost: cost, each: people <= 0 ? cost : cost / people);
}

// ---------------------------------------------------------------- walking

/// Rough steps for a walk (about 1,300 steps a km). Always shown as rough.
int roughSteps(double km) => (km * 1300).round();

/// Rough calories for a walk (about 55 kcal a km). Always shown as rough.
int roughKcal(double km) => (km * 55).round();

// ---------------------------------------------------------------- qibla

/// Direction of the Kaaba from a spot, in degrees from north (0–360),
/// calculated on the globe (great circle).
double qiblaBearing(double lat, double lng) {
  const kLat = 21.4225, kLng = 39.8262;
  double rad(double d) => d * math.pi / 180;
  final p1 = rad(lat), p2 = rad(kLat), dl = rad(kLng - lng);
  final y = math.sin(dl);
  final x = math.cos(p1) * math.tan(p2) - math.sin(p1) * math.cos(dl);
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

// ---------------------------------------------------------------- Hijri date

/// The Hijri date by the arithmetic (tabular) calendar. It can differ by a
/// day from the official date, which follows the moon sighting, so it's
/// always shown as approximate.
({int year, int month, int day}) hijriDate(DateTime date) {
  final a = (14 - date.month) ~/ 12;
  final y = date.year + 4800 - a;
  final m = date.month + 12 * a - 3;
  final jd = date.day + (153 * m + 2) ~/ 5 + 365 * y + y ~/ 4 - y ~/ 100 + y ~/ 400 - 32045;
  var l = jd - 1948440 + 10632;
  final n = (l - 1) ~/ 10631;
  l = l - 10631 * n + 354;
  final j = ((10985 - l) ~/ 5316) * ((50 * l) ~/ 17719) + (l ~/ 5670) * ((43 * l) ~/ 15238);
  l = l - ((30 - j) ~/ 15) * ((17719 * j) ~/ 50) - (j ~/ 16) * ((15238 * j) ~/ 43) + 29;
  final month = (24 * l) ~/ 709;
  final day = l - (709 * month) ~/ 24;
  final year = 30 * n + j - 30;
  return (year: year, month: month, day: day);
}

const hijriMonths = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani", 'Jumada al-Ula', 'Jumada al-Akhirah',
  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qi'dah", 'Dhu al-Hijjah',
];

/// "14 Jumada al-Ula 1448" (translated month name).
String hijriText(DateTime date) {
  final h = hijriDate(date);
  return '${h.day} ${tr(hijriMonths[h.month - 1])} ${h.year}';
}

/// Days until the next [day] of Hijri [month] (arithmetic calendar),
/// 0 when it's today. Approximate (± a day or two).
int daysUntilHijri(DateTime from, int month, int day) {
  final start = DateTime(from.year, from.month, from.day);
  for (var i = 0; i < 400; i++) {
    final h = hijriDate(start.add(Duration(days: i)));
    if (h.month == month && h.day == day) return i;
  }
  return -1;
}

/// Days until the next 1st of [month] (e.g. 9 = Ramadan) on the arithmetic
/// calendar, or 0 when today is that day. Approximate (± a day or two).
int daysUntilHijriMonth(DateTime from, int month) {
  final start = DateTime(from.year, from.month, from.day);
  for (var i = 0; i < 400; i++) {
    final h = hijriDate(start.add(Duration(days: i)));
    if (h.month == month && h.day == 1) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- plus codes

const _olc = '23456789CFGHJMPQRVWX';

/// The Open Location Code ("plus code") for a spot, e.g. "7GXHX4HM+3V".
/// Calculated from the coordinates, so it's as exact as the map point.
String plusCode(double lat, double lng) {
  final la = lat.clamp(-90.0, 89.9999999);
  var ln = (lng + 180) % 360;
  if (ln < 0) ln += 360;
  var latVal = ((la + 90) * 8000).floor();
  var lngVal = (ln * 8000).floor();
  var code = '';
  for (var i = 0; i < 5; i++) {
    code = '${_olc[latVal % 20]}${_olc[lngVal % 20]}$code';
    latVal ~/= 20;
    lngVal ~/= 20;
  }
  return '${code.substring(0, 8)}+${code.substring(8)}';
}

// ---------------------------------------------------------------- clocks

/// "04:07" or "1:02:03" for timers and stopwatches.
String clockText(Duration d) {
  final neg = d.isNegative;
  final s = d.inSeconds.abs();
  String two(int n) => n.toString().padLeft(2, '0');
  final h = s ~/ 3600, m = (s % 3600) ~/ 60, sec = s % 60;
  return '${neg ? '-' : ''}${h > 0 ? '$h:${two(m)}' : two(m)}:${two(sec)}';
}

// ---------------------------------------------------------------- plans

int? _min(String? hhmm) {
  if (hhmm == null) return null;
  final p = hhmm.split(':');
  if (p.length != 2) return null;
  final h = int.tryParse(p[0]), m = int.tryParse(p[1]);
  return h == null || m == null ? null : h * 60 + m;
}

/// Minutes from the first stop's start to the last stop's end, or null.
int? planSpanMinutes(List<PlanStop> stops) {
  final start = _min(stops.firstOrNull?.startTime);
  final end = _min(planEndTime(stops));
  if (start == null || end == null) return null;
  var span = end - start;
  if (span < 0) span += 1440;
  return span;
}

/// Straight-line km between the stops (what the plan already shows per leg).
double planWalkKm(List<PlanStop> stops) =>
    stops.fold(0.0, (s, p) => s + (p.kmFromPrevious ?? 0));

/// How many stops of each kind, most first ("cafe" → 2).
List<MapEntry<String, int>> categoryMix(List<PlanStop> stops) {
  final m = <String, int>{};
  for (final s in stops) {
    m[s.category] = (m[s.category] ?? 0) + 1;
  }
  return m.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
}

/// Indexes of stops that start after sunset on [day] at the plan's spot.
/// Sunset is turned into the phone's time ([utcOffset] only for tests).
Set<int> stopsAfterSunset(List<PlanStop> stops, DateTime day, double lat, double lng, {Duration? utcOffset}) {
  final sun = sunTimes(day, lat, lng);
  if (sun == null) return const {};
  final local = utcOffset == null ? sun.sunset.toLocal() : sun.sunset.add(utcOffset);
  final sunset = local.hour * 60 + local.minute;
  return {
    for (final (i, s) in stops.indexed)
      if (_min(s.startTime) case final m? when m >= sunset) i,
  };
}

/// The plan as a ticklist to paste anywhere: "☑ 18:00 Café", "☐ 19:15 Park".
String checklistText(OutingPlan plan, Set<String> done) => [
      plan.title,
      for (final s in plan.stops)
        '${done.contains(s.placeId) ? '☑' : '☐'} ${s.startTime == null ? '' : '${s.startTime} '}${s.name}',
    ].join('\n');

/// Plans whose title, stop names or areas match every word of [query].
List<OutingPlan> searchPlans(List<OutingPlan> plans, String query) {
  final words = normalizeSearch(query).split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty) return plans;
  return plans.where((p) {
    final hay = normalizeSearch([p.title, for (final s in p.stops) ...[s.name, ?s.area]].join(' '));
    return words.every(hay.contains);
  }).toList();
}

enum PlanSort { soonest, newest, title }

/// Sorted copy: soonest outing day first (no day = last), newest made first,
/// or by title.
List<OutingPlan> sortPlans(List<OutingPlan> plans, PlanSort by) {
  final out = [...plans];
  switch (by) {
    case PlanSort.soonest:
      out.sort((a, b) {
        if (a.request.date == null && b.request.date == null) return 0;
        if (a.request.date == null) return 1;
        if (b.request.date == null) return -1;
        return a.request.day.compareTo(b.request.day);
      });
    case PlanSort.newest:
      out.sort((a, b) => (b.createdAt ?? DateTime(2000)).compareTo(a.createdAt ?? DateTime(2000)));
    case PlanSort.title:
      out.sort((a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()));
  }
  return out;
}

/// Pinned plans first (in pin order), the rest after, keeping their order.
List<OutingPlan> pinnedFirst(List<OutingPlan> plans, List<String> pinned) {
  final pins = [for (final id in pinned) ...plans.where((p) => p.id == id)];
  return [...pins, ...plans.where((p) => !pinned.contains(p.id))];
}

/// Labels you can put on a plan (on this phone only): key → emoji.
const planTags = {
  'date': '💕',
  'birthday': '🎂',
  'family': '👨‍👩‍👧',
  'friends': '👯',
  'work': '💼',
  'chill': '🧘',
  'food': '🍽️',
  'trip': '🧳',
};

String planTagLabel(String key) => switch (key) {
      'date' => tr('Date'),
      'birthday' => tr('Birthday'),
      'family' => tr('Family'),
      'friends' => tr('Friends'),
      'work' => tr('Work'),
      'chill' => tr('Chill'),
      'food' => tr('Food'),
      'trip' => tr('Trip'),
      _ => key,
    };

// ---------------------------------------------------------------- games

/// Rock paper scissors: 1 = first wins, -1 = second wins, 0 = draw.
/// Moves: 0 rock, 1 paper, 2 scissors.
int rpsWinner(int a, int b) {
  if (a == b) return 0;
  return (a - b + 3) % 3 == 1 ? 1 : -1;
}

/// "Would you rather" questions for the table.
List<(String, String)> wouldYouRather() => [
      (tr('Breakfast by the Nile'), tr('Dinner on a rooftop')),
      (tr('Always pick the place'), tr('Never pay the bill')),
      (tr('A day in Alexandria'), tr('A night in Zamalek')),
      (tr('Only street food for a month'), tr('Only fancy restaurants for a month')),
      (tr('Go to a museum'), tr('Go to an escape room')),
      (tr('Plan everything'), tr('Be surprised every time')),
      (tr('Cinema at night'), tr('Bowling in the afternoon')),
      (tr('Walk 10 km'), tr('Sit in traffic for an hour')),
      (tr('Koshary every day'), tr('Feteer every day')),
      (tr('Live in a mall'), tr('Live in a park')),
      (tr('Always be early'), tr('Always be 10 minutes late')),
      (tr('Sunrise at the pyramids'), tr('Sunset on the corniche')),
      (tr('Have no phone for a day'), tr('Have no music for a week')),
      (tr('Go out every night'), tr('Stay home every weekend')),
      (tr('Karaoke in front of everyone'), tr('Dance in front of everyone')),
      (tr('Only tea forever'), tr('Only coffee forever')),
      (tr('A big group outing'), tr('A quiet outing for two')),
      (tr('Be the photographer'), tr('Be in every photo')),
      (tr('Beach in summer'), tr('Desert camp in winter')),
      (tr('Know every shortcut in Cairo'), tr('Never get stuck in traffic again')),
    ];

/// Words for charades, by category.
Map<String, List<String>> charadesWords() => {
      tr('Animals'): [
        tr('Cat'), tr('Camel'), tr('Elephant'), tr('Monkey'), tr('Penguin'), tr('Lion'),
        tr('Frog'), tr('Snake'), tr('Horse'), tr('Chicken'), tr('Kangaroo'), tr('Dolphin'),
      ],
      tr('Jobs'): [
        tr('Doctor'), tr('Teacher'), tr('Chef'), tr('Pilot'), tr('Taxi driver'), tr('Football player'),
        tr('Barber'), tr('Photographer'), tr('Police officer'), tr('Singer'), tr('Dentist'), tr('Waiter'),
      ],
      tr('Things to do'): [
        tr('Swimming'), tr('Taking a selfie'), tr('Cooking'), tr('Driving'), tr('Fishing'), tr('Dancing'),
        tr('Brushing teeth'), tr('Playing football'), tr('Reading'), tr('Riding a bike'), tr('Sleeping'),
        tr('Washing dishes'),
      ],
      tr('Objects'): [
        tr('Umbrella'), tr('Phone'), tr('Guitar'), tr('Scissors'), tr('Camera'), tr('Glasses'),
        tr('Ladder'), tr('Balloon'), tr('Key'), tr('Clock'), tr('Toothbrush'), tr('Kite'),
      ],
    };

/// Fun names for a group chat.
List<String> groupNameIdeas() => [
      tr('The Weekend Squad'), tr('Always Hungry'), tr('Late Again'), tr('The Planners'),
      tr('Koshary Club'), tr('Night Owls'), tr('Coffee First'), tr('The Explorers'),
      tr('Friday Crew'), tr('Lost in Cairo'), tr('The Foodies'), tr('Sunset Chasers'),
      tr('No Plan Gang'), tr('Tea Time'), tr('Road Trippers'), tr('The Usual Suspects'),
    ];

/// Shuffled copy (for turn order / who sits where).
List<T> shuffled<T>(List<T> items, [math.Random? r]) => [...items]..shuffle(r ?? math.Random());

// ---------------------------------------------------------------- my data

/// Everything this phone keeps (its saved settings and lists), as readable
/// JSON to save or share. Nothing from Firestore.
String exportPhoneData(Map<String, Object?> prefs) {
  final sorted = Map.fromEntries(prefs.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
  return const JsonEncoder.withIndent('  ').convert({
    'app': 'Khroga',
    'exported': DateTime.now().toIso8601String(),
    'phoneData': sorted,
  });
}

/// Greeting with your nickname when you set one ("Good morning, Misho").
String withNickname(String greeting, String? nickname) {
  final n = nickname?.trim() ?? '';
  return n.isEmpty ? greeting : trf('{greeting}, {name}', {'greeting': greeting, 'name': n});
}
