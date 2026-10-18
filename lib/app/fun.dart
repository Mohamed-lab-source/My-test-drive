/// Game-like extras built only from real data (tested in test/fun_test.dart):
/// badges from your own activity, monthly recaps, your outing personality,
/// a monthly bingo card, place of the day, smart collections from map tags,
/// and small party tools. Nothing here invents facts about places.
library;

import 'dart:math' as math;

import '../models/place.dart';
import '../models/plan.dart';
import 'i18n.dart';

// ------------------------------------------------------------------ badges

/// Your own numbers, all from your account or this phone.
class BadgeCounts {
  const BadgeCounts({
    this.plans = 0,
    this.savedPlans = 0,
    this.favorites = 0,
    this.visited = 0,
    this.kinds = 0,
    this.areas = 0,
    this.cities = 0,
    this.groups = 0,
    this.friends = 0,
    this.reviews = 0,
    this.detailedReviews = 0,
    this.lists = 0,
    this.ratings = 0,
    this.weekStreak = 0,
    this.malls = 0,
    this.culture = 0,
    this.food = 0,
    this.parks = 0,
    this.fun = 0,
    this.lateNight = 0,
  });

  final int plans;
  final int savedPlans;
  final int favorites;
  final int visited;
  final int kinds;
  final int areas;
  final int cities;
  final int groups;
  final int friends;
  final int reviews;
  final int detailedReviews;
  final int lists;
  final int ratings;
  final int weekStreak;
  final int malls;
  final int culture;
  final int food;
  final int parks;
  final int fun;

  /// Places you've been that are open after 23:30 (by their real hours).
  final int lateNight;
}

/// A badge with progress: [have] of [need].
class OutingBadge {
  const OutingBadge(this.key, this.emoji, this._title, this._hint, this.have, this.need);
  final String key;
  final String emoji;
  final String _title;
  final String _hint;
  String get title => tr(_title);
  String get hint => tr(_hint);
  final int have;
  final int need;
  bool get earned => have >= need;
  double get progress => need == 0 ? 1 : (have / need).clamp(0, 1).toDouble();
}

List<OutingBadge> allBadges(BadgeCounts c) => [
  OutingBadge('plan1', '🗺️', 'First plan', 'Make your first plan', c.plans, 1),
  OutingBadge('plan10', '🧭', 'Planner', 'Make 10 plans', c.plans, 10),
  OutingBadge('plan50', '📐', 'Master planner', 'Make 50 plans', c.plans, 50),
  OutingBadge('saved5', '🔖', 'Keeper', 'Save 5 plans', c.savedPlans, 5),
  OutingBadge('fav5', '❤️', 'Collector', 'Save 5 favorite places', c.favorites, 5),
  OutingBadge('fav25', '💖', 'Big heart', 'Save 25 favorite places', c.favorites, 25),
  OutingBadge('been5', '✅', 'Out and about', "Mark 5 places you've been", c.visited, 5),
  OutingBadge('been25', '🏙️', 'City explorer', "Mark 25 places you've been", c.visited, 25),
  OutingBadge('been100', '🚀', 'Unstoppable', "Mark 100 places you've been", c.visited, 100),
  OutingBadge('kinds5', '🎨', 'All-rounder', 'Visit 5 different kinds of places', c.kinds, 5),
  OutingBadge('kinds9', '🌈', 'Tried it all', 'Visit 9 different kinds of places', c.kinds, 9),
  OutingBadge('areas5', '🏘️', 'Area hopper', 'Visit places in 5 different areas', c.areas, 5),
  OutingBadge('areas15', '🗾', 'Neighbourhood pro', 'Visit places in 15 different areas', c.areas, 15),
  OutingBadge('cities2', '🚆', 'Traveller', 'Visit places in 2 cities', c.cities, 2),
  OutingBadge('cities3', '🧳', 'Three cities', 'Visit places in Cairo, Giza and Alexandria', c.cities, 3),
  OutingBadge('food10', '🍽️', 'Foodie', 'Visit 10 restaurants or cafés', c.food, 10),
  OutingBadge('culture5', '🏛️', 'History lover', 'Visit 5 museums or sights', c.culture, 5),
  OutingBadge('parks5', '🌳', 'Fresh air', 'Visit 5 parks', c.parks, 5),
  OutingBadge('fun5', '🎳', 'Fun seeker', 'Visit 5 fun places (games, cinemas, escape rooms)', c.fun, 5),
  OutingBadge('malls3', '🛍️', 'Mall rat', 'Visit 3 malls', c.malls, 3),
  OutingBadge('late3', '🌙', 'Night owl', 'Visit 3 places that stay open late', c.lateNight, 3),
  OutingBadge('streak3', '🔥', 'On a roll', 'Make a plan 3 weeks in a row', c.weekStreak, 3),
  OutingBadge('streak8', '☄️', 'Unbreakable', 'Make a plan 8 weeks in a row', c.weekStreak, 8),
  OutingBadge('group1', '👯', 'Organizer', 'Be in a group', c.groups, 1),
  OutingBadge('group3', '🎪', 'Party planner', 'Be in 3 groups', c.groups, 3),
  OutingBadge('friend3', '🤝', 'Social', 'Have 3 friends', c.friends, 3),
  OutingBadge('friend10', '🫂', 'Popular', 'Have 10 friends', c.friends, 10),
  OutingBadge('review1', '✍️', 'First review', 'Write your first review', c.reviews, 1),
  OutingBadge('review10', '📝', 'Critic', 'Write 10 reviews', c.reviews, 10),
  OutingBadge('detail5', '🔍', 'Detail hunter', 'Write 5 detailed reviews', c.detailedReviews, 5),
  OutingBadge('list1', '📋', 'List maker', 'Make a list of places', c.lists, 1),
  OutingBadge('rate5', '⭐', 'Star giver', 'Give your own stars to 5 places', c.ratings, 5),
];

/// Badges earned now that weren't in [seen] (to celebrate once).
List<OutingBadge> newBadges(List<OutingBadge> badges, Set<String> seen) => [
  for (final b in badges)
    if (b.earned && !seen.contains(b.key)) b,
];

/// Counts used by badges, from places you've been.
BadgeCounts countsFromVisited(
  List<Place> visited, {
  int plans = 0,
  int savedPlans = 0,
  int favorites = 0,
  int groups = 0,
  int friends = 0,
  int reviews = 0,
  int detailedReviews = 0,
  int lists = 0,
  int ratings = 0,
  int weekStreak = 0,
}) {
  int n(bool Function(Place) f) => visited.where(f).length;
  return BadgeCounts(
    plans: plans,
    savedPlans: savedPlans,
    favorites: favorites,
    visited: visited.length,
    kinds: visited.map((p) => p.category).toSet().length,
    areas: visited.map((p) => p.area).whereType<String>().toSet().length,
    cities: visited.map((p) => p.city).toSet().length,
    groups: groups,
    friends: friends,
    reviews: reviews,
    detailedReviews: detailedReviews,
    lists: lists,
    ratings: ratings,
    weekStreak: weekStreak,
    malls: n((p) => p.category == 'mall'),
    culture: n((p) => p.category == 'museum' || p.category == 'sight'),
    food: n((p) => p.category == 'restaurant' || p.category == 'cafe'),
    parks: n((p) => p.category == 'park'),
    fun: n((p) => const {'entertainment', 'escape_room', 'activity', 'cinema'}.contains(p.category)),
    lateNight: n(isOpenLate),
  );
}

// ----------------------------------------------------------- personality

class OuterType {
  const OuterType(this.emoji, this._title, this._line);
  final String emoji;
  final String _title;
  final String _line;
  String get title => tr(_title);
  String get line => tr(_line);
}

const _foodie = OuterType('🍽️', 'The Foodie', 'You go out to eat, and you know where.');
const _cafe = OuterType('☕', 'The Café Hopper', 'A good café and good company is your perfect outing.');
const _culture = OuterType('🏛️', 'The History Buff', 'Museums and old streets are your thing.');
const _thrill = OuterType('🎢', 'The Thrill Seeker', 'Games, escape rooms and anything with a scoreboard.');
const _outdoors = OuterType('🌳', 'The Fresh-Air Lover', 'Parks, gardens and open sky.');
const _mall = OuterType('🛍️', 'The Mall Pro', 'You know every mall, floor by floor.');
const _explorer = OuterType('🧭', 'The Explorer', 'A bit of everything: you never go to the same kind of place twice.');
const _night = OuterType('🌙', 'The Night Owl', 'Your outings start when the sun goes down.');

/// What kind of outing person you are, from the kinds of places you've been
/// and the vibes you plan. Null until there's enough to say (3+ places).
OuterType? outerTypeFor(List<Place> visited, List<String> vibes) {
  if (visited.length < 3) return null;
  if (vibes.length >= 3 && vibes.where((v) => v == 'nightlife').length * 2 > vibes.length) return _night;
  final groups = <String, int>{};
  var cafes = 0;
  for (final p in visited) {
    final g = switch (p.category) {
      'cafe' || 'restaurant' => 'food',
      'museum' || 'sight' => 'culture',
      'entertainment' || 'escape_room' || 'activity' || 'cinema' => 'thrill',
      'park' => 'outdoors',
      'mall' || 'shop' => 'mall',
      _ => null,
    };
    if (p.category == 'cafe') cafes++;
    if (g != null) groups[g] = (groups[g] ?? 0) + 1;
  }
  if (groups.isEmpty) return _explorer;
  final top = groups.entries.reduce((a, b) => b.value > a.value ? b : a);
  // Lots of kinds and nothing above 40%: an explorer.
  if (visited.map((p) => p.category).toSet().length >= 5 && top.value * 10 < visited.length * 4) {
    return _explorer;
  }
  return switch (top.key) {
    'food' => cafes * 2 > top.value ? _cafe : _foodie,
    'culture' => _culture,
    'thrill' => _thrill,
    'outdoors' => _outdoors,
    _ => _mall,
  };
}

// ------------------------------------------------------------------ recap

class Recap {
  const Recap({
    required this.plans,
    required this.stops,
    required this.newPlaces,
    required this.km,
    this.topArea,
    this.topCategory,
    this.topVibe,
    this.busiestDay,
  });

  final int plans;
  final int stops;
  final int newPlaces;

  /// Straight-line km between planned stops (a rough number, labeled so).
  final double km;
  final String? topArea;
  final String? topCategory;
  final String? topVibe;

  /// Weekday (1 = Monday) you made the most plans on.
  final int? busiestDay;

  bool get isEmpty => plans == 0 && newPlaces == 0;
}

String? _most(Iterable<String?> xs) {
  final m = <String, int>{};
  for (final x in xs) {
    if (x != null && x.isNotEmpty) m[x] = (m[x] ?? 0) + 1;
  }
  if (m.isEmpty) return null;
  return m.entries.reduce((a, b) => b.value > a.value ? b : a).key;
}

/// Your outings between [from] (included) and [to] (not included).
Recap recapOf(DateTime from, DateTime to, List<OutingPlan> plans, List<(Place, DateTime?)> visited) {
  bool inside(DateTime? t) => t != null && !t.isBefore(from) && t.isBefore(to);
  final ps = plans.where((p) => inside(p.createdAt)).toList();
  final been = [
    for (final (p, t) in visited)
      if (inside(t)) p,
  ];
  final stops = ps.expand((p) => p.stops).toList();
  final day = _most(ps.map((p) => '${p.createdAt!.weekday}'));
  return Recap(
    plans: ps.length,
    stops: stops.length,
    newPlaces: been.length,
    km: stops.fold(0.0, (s, x) => s + (x.kmFromPrevious ?? 0)),
    topArea: _most([...been.map((p) => p.area), ...stops.map((s) => s.area)]),
    topCategory: _most([...been.map((p) => p.category), ...stops.map((s) => s.category)]),
    topVibe: _most(ps.expand((p) => p.request.vibes)),
    busiestDay: day == null ? null : int.parse(day),
  );
}

// ------------------------------------------------------------------ bingo

class BingoSquare {
  const BingoSquare(this.key, this.emoji, this._label, this.test);
  final String key;
  final String emoji;
  final String _label;
  String get label => tr(_label);
  final bool Function(Place) test;
}

final bingoSquares = <BingoSquare>[
  BingoSquare('cafe', '☕', 'A café', (p) => p.category == 'cafe'),
  BingoSquare('restaurant', '🍽️', 'A restaurant', (p) => p.category == 'restaurant'),
  BingoSquare('park', '🌳', 'A park', (p) => p.category == 'park'),
  BingoSquare('culture', '🏛️', 'A museum or sight', (p) => p.category == 'museum' || p.category == 'sight'),
  BingoSquare('mall', '🛍️', 'A mall', (p) => p.category == 'mall'),
  BingoSquare(
    'fun',
    '🎳',
    'Something fun',
    (p) => const {'entertainment', 'escape_room', 'activity'}.contains(p.category),
  ),
  BingoSquare('cinema', '🎬', 'A cinema', (p) => p.category == 'cinema'),
  BingoSquare('wifi', '📶', 'A place with Wi-Fi', (p) => p.details.wifi == true),
  BingoSquare('late', '🌙', 'A place open late', isOpenLate),
  BingoSquare('famous', '📖', 'A place on Wikipedia', (p) => p.wikidata != null),
  BingoSquare('outdoor', '⛱️', 'Outdoor seating', (p) => p.details.outdoorSeating == true),
  BingoSquare('alex', '🌊', 'Somewhere in Alexandria', (p) => p.city == 'alexandria'),
  BingoSquare('giza', '🐪', 'Somewhere in Giza', (p) => p.city == 'giza'),
  BingoSquare(
    'cuisine',
    '🍜',
    'A food from another country',
    (p) => p.cuisine != null && !RegExp('egyptian|coffee|regional', caseSensitive: false).hasMatch(p.cuisine!),
  ),
];

/// The 9 squares for a month (the same for everyone that month).
List<BingoSquare> bingoFor(DateTime month) {
  final list = [...bingoSquares]..shuffle(math.Random(month.year * 100 + month.month));
  return list.take(9).toList();
}

/// Which squares are done by places you've been to this month.
List<bool> bingoDone(List<BingoSquare> card, Iterable<Place> visitedThisMonth) => [
  for (final s in card) visitedThisMonth.any(s.test),
];

/// Full rows, columns and diagonals on a 3×3 card.
int bingoLines(List<bool> done) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], //
    [0, 3, 6], [1, 4, 7], [2, 5, 8], //
    [0, 4, 8], [2, 4, 6],
  ];
  return lines.where((l) => l.every((i) => i < done.length && done[i])).length;
}

// --------------------------------------------------------- place of the day

/// One well-documented real place per day, the same for everyone that day.
Place? placeOfTheDay(List<Place> places, DateTime day) {
  var pool = places.where((p) => p.category != 'shop' && p.hasLocation && p.quality >= 4).toList();
  if (pool.isEmpty) pool = places.where((p) => p.category != 'shop' && p.hasLocation).toList();
  if (pool.isEmpty) return null;
  pool.sort((a, b) => a.id.compareTo(b.id));
  final seed = day.year * 10000 + day.month * 100 + day.day;
  return pool[(seed * 2654435761) % pool.length];
}

/// A random real place (for "Feeling lucky").
Place? luckyPlace(List<Place> places, math.Random rng) {
  final pool = places.where((p) => p.category != 'shop' && p.quality >= 3).toList();
  final from = pool.isEmpty ? places.where((p) => p.category != 'shop').toList() : pool;
  return from.isEmpty ? null : from[rng.nextInt(from.length)];
}

// -------------------------------------------------------- smart collections

/// Open after 23:30 on at least one day, by its real opening hours.
bool isOpenLate(Place p) {
  final h = p.hours;
  if (h == null) return false;
  if (h.alwaysOpen) return true;
  for (var d = 1; d <= 7; d++) {
    for (final (_, e) in h.intervalsOn(d) ?? const <(int, int)>[]) {
      if (e >= 23 * 60 + 30) return true;
    }
  }
  return false;
}

class SmartCollection {
  const SmartCollection(this.key, this.emoji, this._title, this._hint, this.test);
  final String key;
  final String emoji;
  final String _title;
  final String _hint;
  String get title => tr(_title);
  String get hint => tr(_hint);
  final bool Function(Place) test;
}

final smartCollections = <SmartCollection>[
  SmartCollection(
    'work',
    '💻',
    'Work and study spots',
    'Cafés and restaurants with Wi-Fi on the map',
    (p) => p.details.wifi == true && (p.category == 'cafe' || p.category == 'restaurant'),
  ),
  SmartCollection('late', '🌙', 'Open late', 'Open after 11:30 pm on at least one day', isOpenLate),
  SmartCollection('24h', '🕛', 'Open 24 hours', 'Hours say 24/7', (p) => p.hours?.alwaysOpen ?? false),
  SmartCollection(
    'famous',
    '📖',
    'Famous places',
    'Places with a Wikipedia or Wikidata entry',
    (p) => p.wikidata != null,
  ),
  SmartCollection(
    'wheelchair',
    '♿',
    'Wheelchair friendly',
    'Marked wheelchair accessible',
    (p) => p.details.wheelchair == 'yes',
  ),
  SmartCollection('kids', '🧸', 'Kids areas', 'Places with a kids area', (p) => p.details.kidsArea == true),
  SmartCollection(
    'veg',
    '🥗',
    'Vegetarian friendly',
    'Vegetarian options on the map',
    (p) => p.details.vegetarian == 'yes' || p.details.vegetarian == 'only',
  ),
  SmartCollection('halal', '🕌', 'Halal', 'Marked halal', (p) => p.details.halal == true),
  SmartCollection('outdoor', '⛱️', 'Outdoor seating', 'Sit outside', (p) => p.details.outdoorSeating == true),
  SmartCollection('nosmoke', '🚭', 'Smoke-free', 'Marked no smoking inside', (p) => p.details.smoking == 'no'),
  SmartCollection('shisha', '💨', 'Shisha', 'Cafés that serve shisha', (p) => p.details.shisha == true),
  SmartCollection('ac', '❄️', 'Air-conditioned', 'Good for hot days', (p) => p.details.airConditioning == true),
  SmartCollection('delivery', '🛵', 'Delivers', 'Marked as delivering', (p) => p.details.delivery == true),
  SmartCollection('photos', '📸', 'With photos', 'Places with a real photo', (p) => p.photoUrl != null),
  SmartCollection('cards', '💳', 'Takes cards', 'Card payments marked on the map', (p) => p.details.cards == true),
  SmartCollection(
    'book',
    '📅',
    'Booking recommended',
    'The map says to reserve',
    (p) => p.details.reservation == 'required' || p.details.reservation == 'recommended',
  ),
];

/// Places in [city] for a collection, best-documented first.
List<Place> collectionPlaces(SmartCollection c, List<Place> all, String city) =>
    all.where((p) => p.city == city && p.category != 'shop' && c.test(p)).toList()
      ..sort((a, b) => b.quality.compareTo(a.quality));

// ---------------------------------------------------------- area explorer

typedef AreaProgress = ({String area, int total, int been});

/// For each area with at least [minPlaces] places: how many you've been to.
/// Areas you've started come first.
List<AreaProgress> areaProgress(List<Place> all, Set<String> visitedIds, String city, {int minPlaces = 5}) {
  final total = <String, int>{};
  final been = <String, int>{};
  for (final p in all) {
    if (p.city != city || p.area == null || p.category == 'shop') continue;
    total[p.area!] = (total[p.area!] ?? 0) + 1;
    if (visitedIds.contains(p.id)) been[p.area!] = (been[p.area!] ?? 0) + 1;
  }
  final out = [
    for (final e in total.entries)
      if (e.value >= minPlaces) (area: e.key, total: e.value, been: been[e.key] ?? 0),
  ];
  out.sort((a, b) {
    final c = b.been.compareTo(a.been);
    return c != 0 ? c : b.total.compareTo(a.total);
  });
  return out;
}

// ------------------------------------------------------------ party tools

/// Shuffles [names] into [teams] teams as evenly as possible.
List<List<String>> makeTeams(List<String> names, int teams, math.Random rng) {
  final n = teams.clamp(1, math.max(1, names.length)).toInt();
  final shuffled = [...names]..shuffle(rng);
  final out = List.generate(n, (_) => <String>[]);
  for (final (i, name) in shuffled.indexed) {
    out[i % n].add(name);
  }
  return out;
}

/// Simple questions to get people talking (not about places).
const conversationStarters = [
  'What was the best outing you ever had?',
  'If you could live in any area of the city, which one?',
  'What food could you eat every day?',
  "What's a place you've always wanted to try but never did?",
  'Morning person or night person?',
  "What's the best thing that happened to you this week?",
  'Which city would you visit tomorrow if you could?',
  'What was your favorite place as a kid?',
  "What's a small thing that always makes your day better?",
  'Tea or coffee, and how do you take it?',
  "What's the last thing you learned that surprised you?",
  'Beach or mountains?',
  'What would your perfect Friday look like?',
  "What's a movie you can watch again and again?",
  'If you opened a café, what would you call it?',
  "What's one skill you'd love to learn?",
  'Who in this group would survive longest on a desert island?',
  "What's the funniest thing that happened on an outing?",
  'What song always gets you dancing?',
  "What's your go-to order when you can't decide?",
];

/// Next 7 days as poll options, e.g. "Thu 15".
List<DateTime> nextDays(DateTime now, {int count = 7}) => [
  for (var i = 0; i < count; i++) DateTime(now.year, now.month, now.day + i),
];

// ------------------------------------------------------------- memories

/// A place you marked "Been there" on this day of the month 1–12 months ago
/// (newest first): (place, months ago). Null when there is none.
(Place, int)? onThisDay(List<(Place, DateTime?)> visited, DateTime now) {
  for (var months = 1; months <= 12; months++) {
    final then = DateTime(now.year, now.month - months, now.day);
    if (then.day != now.day) continue; // e.g. no 31st that month
    for (final (p, t) in visited) {
      if (t != null && t.year == then.year && t.month == then.month && t.day == then.day) return (p, months);
    }
  }
  return null;
}

/// How many things you did each day (plans made + places marked), for the
/// last [days] days ending today: index 0 = the oldest day.
List<int> activityDays(Iterable<DateTime> moments, DateTime now, {int days = 84}) {
  final today = DateTime(now.year, now.month, now.day);
  final out = List.filled(days, 0);
  for (final m in moments) {
    final d = today.difference(DateTime(m.year, m.month, m.day)).inDays;
    if (d >= 0 && d < days) out[days - 1 - d]++;
  }
  return out;
}

/// Emergency numbers in Egypt (public, nationwide).
const emergencyNumbers = [
  ('🚓', 'Police', '122'),
  ('🚑', 'Ambulance', '123'),
  ('🚒', 'Fire', '180'),
  ('🧳', 'Tourist police', '126'),
];

/// Useful Egyptian Arabic for visitors: (English, Arabic, how to say it).
const phrasebook = [
  ('Hello', 'أهلاً', 'ahlan'),
  ('Thank you', 'شكراً', 'shukran'),
  ('Please', 'لو سمحت', 'law samaht'),
  ('Yes / No', 'أيوه / لأ', 'aywa / la'),
  ('How much is this?', 'بكام ده؟', 'bikam da?'),
  ('The bill, please', 'الحساب لو سمحت', 'el-hesab law samaht'),
  ('Where is…?', 'فين…؟', 'fein…?'),
  ('Take me to…', 'وديني…', 'waddini…'),
  ('Stop here, please', 'على جنب هنا لو سمحت', "'ala ganb hena law samaht"),
  ('Water', 'مية', 'mayya'),
  ('Coffee / Tea', 'قهوة / شاي', "'ahwa / shai"),
  ('No sugar', 'من غير سكر', 'men gheir sokkar'),
  ('Delicious!', 'حلو أوي!', 'helw awi!'),
  ('Where is the toilet?', 'الحمام فين؟', 'el-hammam fein?'),
  ('I don\'t understand', 'مش فاهم', 'mesh fahem'),
  ('Do you speak English?', 'بتتكلم إنجليزي؟', 'betetkallem engelizi?'),
  ('Excuse me', 'لو سمحت', 'law samaht'),
  ('Good morning', 'صباح الخير', 'sabah el-kheir'),
  ('Good night', 'تصبح على خير', 'tesbah \'ala kheir'),
  ('Help!', 'الحقوني!', 'el-ha\'uni!'),
];
