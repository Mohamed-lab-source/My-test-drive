/// Which places are worth suggesting, and how well-known they are.
///
/// Everything here only *removes* or *ranks* real places from our data. Nothing
/// is added or invented. Signals come from the map itself: how well an entry
/// is documented, Wikidata / a Commons photo (notable places), whether it's
/// one branch of a big chain, and its type (e.g. "fast food restaurant").
/// None of it is ever shown as a rating.
library;

import 'dart:math' as math;

import '../models/place.dart';

const _centers = <String, (double, double, double)>{
  // lat, lng, max km from the middle of the city
  'cairo': (30.0444, 31.2357, 50),
  'giza': (30.0131, 31.2089, 45),
  'alexandria': (31.2001, 29.9187, 38),
};

/// Places outside the city we say they're in (e.g. a North Coast beach filed
/// under Alexandria). Places without coordinates are kept.
bool tooFarFromCity(Place p) {
  final c = _centers[p.city];
  if (c == null || !p.hasLocation) return false;
  return _km(c.$1, c.$2, p.lat!, p.lng!) > c.$3;
}

// Names that are clearly not somewhere to go out: offices, homes, shops for
// services, schools, addresses.
final _junk = RegExp(
  r'(real ?estate|properties|property|developments?|developers?|brokers?|compound|residence|residential|'
  r'apartments?|\bflats?\b|\boffice\b|company|\bco\.|\bltd\b|agency|production|'
  r'insurance|\bbank\b|pharmacy|clinic|hospital|dental|\bschool\b|nursery|kindergarten|university|'
  r'institute|training center|furnished|for rent|for sale|\bstore\b|home accessories|frames|fan ?page|'
  r'ramadan tent|shipping|logistics|\bvape|smoke shop|tobacco|توكيلات|ملاحية|خيمة رمضان|صفحة|فيب|سجائر|'
  r'عقار|عقارات|التسويق العقاري|للتسويق|للتطوير|كمبوند|كومباوند|كمباوند|ابراج|أبراج|برج سكني|شقة|شقق|'
  r'مفروشة|مكتب|شركة|شركه|للانتاج|للإنتاج|تأمين|بنك|صيدلي|عيادة|عياده|مستشفى|مستشفي|'
  r'مدرسة|مدرسه|حضانة|جامعة|معهد|براويز|للبيع|للايجار|للإيجار|مخزن)',
  caseSensitive: false,
);

// Overture files lots of streets, compounds and addresses as "historic
// sites". From Overture we keep a sight only when its name says what it is.
final _landmark = RegExp(
  r'(palace|citadel|castle|fort\b|mosque|masjid|church|cathedral|monastery|synagogue|temple|tomb|'
  r'mausoleum|pyramid|sphinx|obelisk|\bbab |\bwall\b|sabil|wikala|bayt|beit|house of|museum|'
  r'lighthouse|library|bibliotheca|column|pillar|amphitheat|theatre|catacomb|necropolis|ruins|'
  r'monument|memorial|statue|cairo tower|baron|qasr|qalaa|'
  r'قصر|قلعة|قلعه|طابية|حصن|مسجد|جامع|كنيسة|كنيسه|كاتدرائية|(^|\s)دير(\s|$)|معبد|ضريح|قبة|هرم|'
  r'أهرام|اهرامات|أبو الهول|ابو الهول|مسلة|(^|\s)باب\s|(^|\s)سور(\s|$)|سبيل|وكالة|(^|\s)بيت\s|متحف|فنار|'
  r'منارة|مكتبة|عمود|مسرح|نصب|تمثال|كوم الشقافة|برج القاهرة)',
  caseSensitive: false,
);

final _streetLike = RegExp(r'^\s*\d|شارع|ش\.|street|\bst\.|\broad\b|ميدان .*\d|خلف|بجوار', caseSensitive: false);

/// Kinds that aren't an outing stop even though they sell food or coffee.
const _notOutingKinds = {'internet cafe', 'candy store'};

/// True for entries that aren't really somewhere to go out (an office, a
/// compound, a street, a real-estate agent filed as a "historic site", a
/// place far outside the city...). Only shops are left alone (they're only
/// kept inside malls already).
bool isJunkPlace(Place p) {
  if (p.category == 'mall' || p.category == 'shop') return false;
  final name = p.name.trim();
  if (name.length < 3) return true;
  if (tooFarFromCity(p)) return true;
  if (_notOutingKinds.contains(p.kind)) return true;
  final fromOverture = p.id.startsWith('ov-');
  // Members-only clubs and stadiums, even famous ones, aren't a walk-in outing.
  if (const {'activity', 'park', 'entertainment'}.contains(p.category) &&
      _membersClub.hasMatch(name) &&
      !_horse.hasMatch(name)) {
    return true;
  }
  // A "beach" listed in Cairo or Giza is an office for a beach somewhere else.
  if (p.kind == 'beach' && p.city != 'alexandria') return true;
  final notable = p.wikidata != null || p.photoUrl != null;
  if (notable) return false;
  if (_junk.hasMatch(name)) {
    // A horse club "academy" is fine; an art "academy" is a school. Only
    // the words above count, and they're all clearly not outings.
    return true;
  }
  if (_streetLike.hasMatch(name) && const {'sight', 'park', 'museum', 'activity'}.contains(p.category)) return true;
  if (const {'museum', 'cinema', 'entertainment'}.contains(p.category) &&
      _academy.hasMatch(name)) {
    return true;
  }
  if (fromOverture && p.category == 'sight' && !_landmark.hasMatch(name)) return true;
  if (fromOverture && p.category == 'museum' && p.kind == 'art gallery' &&
      !_galleryWord.hasMatch(name)) {
    return true;
  }
  if (p.category == 'park' && _sportsGround.hasMatch(name)) {
    return true;
  }
  if (_isJustAPlaceName(name)) return true;
  if ((p.category == 'cafe' || p.category == 'restaurant') && _grocery.hasMatch(name)) return true;
  if (fromOverture && p.category == 'sight' && p.hasLocation && _ancient.hasMatch(name) &&
      _ancientSpots.every((s) => _km(s.$1, s.$2, p.lat!, p.lng!) > 4)) {
    return true;
  }
  return false;
}

/// Places you can only really visit in daylight (museums, parks, sights,
/// zoos, beaches, riding...). Theatres are evening places.
bool isDaytimeOnly(Place p) {
  final kind = p.kind ?? '';
  if (kind.contains('theatre')) return false;
  if (const {'museum', 'park', 'sight'}.contains(p.category)) return true;
  if (_daytimeKind.hasMatch(kind)) return true;
  return _daytimeName.hasMatch(p.name);
}

final _academy = RegExp(r'(academy|اكاديمية|أكاديمية)', caseSensitive: false);
final _galleryWord = RegExp(r'(gallery|galerie|art|museum|space|studio|جاليري|معرض|فن|متحف|قاعة)', caseSensitive: false);
final _sportsGround = RegExp(r'(academy|اكاديمية|أكاديمية|ملعب|كرة)', caseSensitive: false);
final _daytimeKind = RegExp(r'(zoo|water park|beach|horse|riding|golf|botanical|aquarium|national park|boat)');
final _daytimeName =
    RegExp(r'(\bzoo\b|حديقة الحيوان|حديقة حيوان|aqua ?park|water ?park|اكوا ?بارك)', caseSensitive: false);

const _placeNames = {
  'cairo', 'giza', 'alexandria', 'alex', 'egypt', 'القاهرة', 'القاهره', 'الجيزة', 'الجيزه', 'الاسكندرية',
  'الإسكندرية', 'الاسكندريه', 'مصر', 'madinaty', 'مدينتي', 'ainshams', 'عين شمس', 'maadi', 'المعادي',
  'zamalek', 'الزمالك', 'heliopolis', 'مصر الجديدة', 'nasr city', 'مدينة نصر', 'october', '6 october',
  '6th of october', 'sheikh zayed', 'الشيخ زايد', 'new cairo', 'القاهرة الجديدة', 'rehab', 'الرحاب',
};

// Supermarkets and kiosks sometimes come in as cafés.
final _grocery = RegExp(
    r'(circle k|carrefour|كارفور|spinneys|سبينيس|oscar|اوسكار|kheir zaman|خير زمان|seoudi|سعودي|metro market|'
    r'مترو ماركت|hyper|هايبر|supermarket|سوبر ?ماركت|ماركت|kiosk|كشك)',
    caseSensitive: false);

// Members-only sports clubs aren't somewhere a group can just walk in.
final _membersClub = RegExp(r'(sporting club|sports club|shooting club|\bclub\b|stadium|استاد|ستاد|ملعب|نادي|نادى)', caseSensitive: false);
final _horse = RegExp(r'(horse|equestrian|riding|stud|ranch|خيل|خيول|فروسية|golf|جولف)', caseSensitive: false);

// Famous ancient sites: an Overture pin with one of these names far from the
// real place is a business listing (a tour office), not the site.
final _ancient = RegExp(r'(pyramid|sphinx|saqq?ara|saqqarah|dahshur|هرم|اهرام|أهرام|سقارة|سقاره|أبو الهول|ابو الهول|دهشور)',
    caseSensitive: false);
const _ancientSpots = [(29.9773, 31.1325), (29.8713, 31.2165), (29.8083, 31.2063)];

bool _isJustAPlaceName(String name) => _placeNames.contains(name.toLowerCase().trim());

// ---------------------------------------------------------------------------
// Chains
// ---------------------------------------------------------------------------

final _branchSplit = RegExp(r'\s+[-–|(]\s*|\s+فرع\s+|\s+branch\s+|,', caseSensitive: false);
final _nonLetters = RegExp(r'[^a-z0-9؀-ۿ]+');

/// The chain part of a name: "Buffalo Burger - Zamalek" → "buffalo burger".
String chainKey(String name) {
  var base = name.split(_branchSplit).first.toLowerCase();
  base = base.replaceFirst(_namePrefix, '');
  base = base.replaceFirst(_nameSuffix, '');
  return base.replaceAll(_nonLetters, ' ').trim();
}

final _namePrefix = RegExp(r'^(مطعم|كافيه|كافية|كافي|مقهى|قهوة|cafe|café|restaurant)\s+');
final _nameSuffix = RegExp(r'\s+(egypt|eg|cairo|giza|alexandria|مصر)$');

/// How many places share each chain name in this list.
Map<String, int> chainSizes(List<Place> places) => _countChains(places, [for (final p in places) chainKey(p.name)]);

Map<String, int> _countChains(List<Place> places, List<String> keys) {
  final counts = <String, int>{};
  for (var i = 0; i < places.length; i++) {
    final p = places[i];
    if (p.category != 'restaurant' && p.category != 'cafe') continue;
    final k = keys[i];
    if (k.length < 3) continue;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

/// Branches of a name found this many times or more count as a chain.
const chainMin = 4;

bool isChain(Place p, Map<String, int> sizes) =>
    p.details.brand != null || (sizes[chainKey(p.name)] ?? 1) >= chainMin;

// ---------------------------------------------------------------------------
// Kinds of food places
// ---------------------------------------------------------------------------

final _fastFoodKind = RegExp(r'(fast.food|sandwich|chicken restaurant|burger|doner|shawarma|hot dog|food court|'
    r'koshari|kushari|foul|fuul|falafel|crepe)', caseSensitive: false);
final _fastFoodName = RegExp(
    r"(buffalo burger|kfc|كنتاكي|mcdonald|ماكدونالدز|hardee|هارديز|burger king|cook door|كوك دور|mo'?men|مؤمن|"
    r"pizza hut|بيتزا هت|domino|دومينوز|papa john|bazooka|bazzoka|بازوكا|abou tarek|ابو طارق|"
    r"كشري|كشرى|طعمية|شاورما|shawerma|shawarma|كبدة|حواوشي|crepe|كريب|sandwich|ساندوتش)",
    caseSensitive: false);

/// A quick, cheap meal (burgers, fried chicken, koshary, sandwiches...).
bool isQuickBite(Place p) {
  if (p.category != 'restaurant') return false;
  if (p.kind != null && _fastFoodKind.hasMatch(p.kind!)) return true;
  final c = p.cuisine ?? '';
  if (_fastFoodCuisine.hasMatch(c) ||
      c.contains('fast_food')) {
    return true;
  }
  return _fastFoodName.hasMatch(p.name);
}

/// Sweet / dessert stop (ice cream, bakery, dessert shop, donuts...).
bool isSweetStop(Place p) {
  final k = '${p.kind ?? ''} ${p.cuisine ?? ''}'.toLowerCase();
  return p.category == 'cafe' && _sweetWord.hasMatch(k);
}

final _fastFoodCuisine = RegExp(r'^(burger|chicken|sandwich|friture|hotdog|kebab|crepe|fast_food)');
final _sweetWord = RegExp(r'(dessert|ice.cream|bakery|donut|patisserie|cake|gelato|chocolat|juice)');

/// The kind of food stop, used so a plan doesn't have two of the same.
String foodRole(Place p) {
  if (p.category == 'restaurant') return isQuickBite(p) ? 'quick' : 'meal';
  if (p.category == 'cafe') {
    if (isSweetStop(p)) return 'sweet';
    if ((p.kind ?? '').contains('hookah') || (p.kind ?? '') == 'lounge') return 'lounge';
    return 'coffee';
  }
  return 'fun';
}

/// How well-known a place probably is, from map signals only (0–30 or so).
/// Used for ranking, never shown.
double fameOf(Place p) {
  var f = math.min(p.quality, 10).toDouble();
  if (p.wikidata != null) f += 8;
  if (p.photoUrl != null) f += 4;
  // OpenStreetMap entries in Egypt are hand-added by mappers, so they tend
  // to be places people actually know.
  if (!p.id.startsWith('ov-')) f += 3;
  if (p.openingHours != null) f += 1;
  if (p.instagram != null) f += 1;
  if (p.details.wheelchair != null || p.details.outdoorSeating != null) f += 1;
  return f;
}

// ---------------------------------------------------------------------------
// Worked out once per place (in the background while places load), so
// making a plan is instant instead of re-reading every name each time.
// ---------------------------------------------------------------------------

class PlaceSignals {
  const PlaceSignals({
    required this.junk,
    required this.chain,
    required this.chainSize,
    required this.quick,
    required this.sweet,
    required this.daytime,
    required this.fame,
    required this.role,
  });

  final bool junk;
  final String chain;
  final int chainSize;
  final bool quick;
  final bool sweet;
  final bool daytime;
  final double fame;
  final String role;

  bool get isChainBranch => chainSize >= chainMin;
}

final _signals = Expando<PlaceSignals>('signals');
final _ready = Expando<bool>('signalsReady');

PlaceSignals _compute(Place p, String key, int size) => PlaceSignals(
      junk: isJunkPlace(p),
      chain: key,
      chainSize: p.details.brand != null ? math.max(size, chainMin) : size,
      quick: isQuickBite(p),
      sweet: isSweetStop(p),
      daytime: isDaytimeOnly(p),
      fame: fameOf(p),
      role: foodRole(p),
    );

/// Works out the signals of every place (chain sizes need the whole list).
/// Runs in the background isolate when places load.
List<PlaceSignals> buildSignals(List<Place> places) {
  final keys = [for (final p in places) chainKey(p.name)];
  final counts = _countChains(places, keys);
  return [for (var i = 0; i < places.length; i++) _compute(places[i], keys[i], counts[keys[i]] ?? 1)];
}

/// Remembers already-worked-out signals for these places.
void attachSignals(List<Place> places, List<PlaceSignals> signals) {
  for (var i = 0; i < places.length && i < signals.length; i++) {
    _signals[places[i]] = signals[i];
  }
  _ready[places] = true;
}

/// Makes sure every place in this list has its signals (only works them
/// out the first time).
void ensureSignals(List<Place> places) {
  if (_ready[places] == true) return;
  attachSignals(places, buildSignals(places));
}

/// The signals of one place (worked out on the spot if it has none yet).
PlaceSignals signalsOf(Place p) => _signals[p] ??= _compute(p, chainKey(p.name), 1);

double _km(double aLat, double aLng, double bLat, double bLng) {
  const r = 6371.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(bLat - aLat);
  final dLng = rad(bLng - aLng);
  final h = math.pow(math.sin(dLat / 2), 2) +
      math.cos(rad(aLat)) * math.cos(rad(bLat)) * math.pow(math.sin(dLng / 2), 2);
  return 2 * r * math.asin(math.sqrt(h));
}
