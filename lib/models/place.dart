import '../app/i18n.dart';
import 'opening_hours.dart';

/// A real place, from OpenStreetMap (bundled in the app at build time).
///
/// Every field comes from real data. Fields we don't know are `null` —
/// never guessed.
class Place {
  const Place({
    required this.id,
    required this.name,
    required this.category,
    required this.city,
    this.nameAr,
    this.kind,
    this.area,
    this.address,
    this.lat,
    this.lng,
    this.cuisine,
    this.openingHours,
    this.parentMallId,
    this.website,
    this.phone,
    this.instagram,
    this.facebook,
    this.menuUrl,
    this.indoor,
    this.osmUrl,
    this.wikidata,
    this.photoUrl,
    this.photoPage,
    this.details = const PlaceFacts(),
    this.quality = 0,
  });

  final String id;
  final String name;
  final String category;
  final String city;
  final String? nameAr;

  /// Finer type from the map, e.g. "clothes" for a shop, "fast_food".
  final String? kind;

  /// Nearest neighbourhood on the map, e.g. "Zamalek".
  final String? area;
  final String? address;
  final double? lat;
  final double? lng;

  /// e.g. "pizza;italian" as written on OpenStreetMap.
  final String? cuisine;

  /// Opening hours as written on OpenStreetMap, e.g. "Mo-Su 10:00-23:00".
  final String? openingHours;
  final String? parentMallId;
  final String? website;
  final String? phone;

  /// Social pages and a menu link, only when the map lists them.
  final String? instagram;
  final String? facebook;
  final String? menuUrl;
  final bool? indoor;

  /// Link to this place on openstreetmap.org (for attribution and fixes).
  final String? osmUrl;
  final String? wikidata;

  /// A real photo from Wikimedia Commons, and its page (for credit).
  final String? photoUrl;
  final String? photoPage;
  final PlaceFacts details;

  /// How complete the map entry is (website, hours, phone...). Used only to
  /// rank places; never shown as a rating.
  final int quality;

  bool get hasLocation => lat != null && lng != null;

  /// The Arabic name in Arabic mode (when the map has one), else the name.
  String get shownName => isArabic && (nameAr?.trim().isNotEmpty ?? false) ? nameAr! : name;

  /// The other-language name, to show under the main one.
  String? get otherName {
    final other = shownName == name ? nameAr : name;
    return other == null || other.trim().isEmpty || other == shownName ? null : other;
  }

  OpeningHours? get hours => OpeningHours.parse(openingHours);

  /// true = open, false = closed, null = we don't know.
  bool? isOpenAt(DateTime time) => hours?.isOpenAt(time);

  String? get cuisineLabel => cuisine
      ?.split(';')
      .map((c) => c.trim().replaceAll('_', ' '))
      .where((c) => c.isNotEmpty && c != 'shisha')
      .take(3)
      .map(tr) // common food types have Arabic names
      .join(', ')
      .let((s) => s.isEmpty ? null : s);

  String? get kindLabel => kind == null ? null : tr(kind!.replaceAll('_', ' '));

  factory Place.fromMap(Map<String, dynamic> m) {
    return Place(
      id: (m['id'] as String?) ?? '',
      name: (m['name'] as String?) ?? 'Unnamed place',
      category: (m['category'] as String?) ?? 'other',
      city: (m['city'] as String?) ?? '',
      nameAr: m['nameAr'] as String?,
      kind: m['kind'] as String?,
      area: m['area'] as String?,
      address: m['address'] as String?,
      lat: (m['lat'] as num?)?.toDouble(),
      lng: (m['lng'] as num?)?.toDouble(),
      cuisine: m['cuisine'] as String?,
      openingHours: m['openingHours'] as String?,
      parentMallId: m['parentMallId'] as String?,
      website: m['website'] as String?,
      phone: m['phone'] as String?,
      instagram: m['instagram'] as String?,
      facebook: m['facebook'] as String?,
      menuUrl: m['menuUrl'] as String?,
      indoor: m['indoor'] as bool?,
      osmUrl: m['osmUrl'] as String?,
      wikidata: m['wikidata'] as String?,
      photoUrl: m['photoUrl'] as String?,
      photoPage: m['photoPage'] as String?,
      details: PlaceFacts.fromMap(
          Map<String, dynamic>.from((m['details'] as Map?) ?? const {})),
      quality: (m['quality'] as num?)?.toInt() ?? 0,
    );
  }
}

extension _Let<T> on T {
  R let<R>(R Function(T) f) => f(this);
}

/// Extra facts copied from the map. Each is null when the map doesn't say.
class PlaceFacts {
  const PlaceFacts({
    this.wheelchair,
    this.outdoorSeating,
    this.wifi,
    this.smoking,
    this.shisha,
    this.takeaway,
    this.delivery,
    this.airConditioning,
    this.vegetarian,
    this.reservation,
    this.cards,
    this.level,
    this.brand,
    this.description,
    this.halal,
    this.kidsArea,
  });

  final bool? halal;
  final bool? kidsArea;

  final String? wheelchair; // yes / limited / no
  final bool? outdoorSeating;
  final bool? wifi;
  final String? smoking; // yes / no / outside / separated / isolated
  final bool? shisha;
  final String? takeaway; // yes / no / only
  final bool? delivery;
  final bool? airConditioning;
  final String? vegetarian; // yes / only / limited
  final String? reservation; // yes / required / recommended / no
  final bool? cards;
  final String? level; // floor inside a building
  final String? brand;
  final String? description;

  factory PlaceFacts.fromMap(Map<String, dynamic> m) => PlaceFacts(
        wheelchair: m['wheelchair'] as String?,
        outdoorSeating: m['outdoorSeating'] as bool?,
        wifi: m['wifi'] as bool?,
        smoking: m['smoking'] as String?,
        shisha: m['shisha'] as bool?,
        takeaway: m['takeaway'] as String?,
        delivery: m['delivery'] as bool?,
        airConditioning: m['airConditioning'] as bool?,
        vegetarian: m['vegetarian'] as String?,
        reservation: m['reservation'] as String?,
        cards: m['cards'] as bool?,
        level: m['level'] as String?,
        brand: m['brand'] as String?,
        description: m['description'] as String?,
        halal: m['halal'] as bool?,
        kidsArea: m['kidsArea'] as bool?,
      );

  /// Readable floor name, e.g. "0" → "Ground floor", "2" → "Floor 2".
  String? get floorLabel {
    final l = level?.split(';').first.trim();
    if (l == null || l.isEmpty) return null;
    if (l == '0') return tr('Ground floor');
    if (l.startsWith('-')) return trf('Basement {n}', {'n': l.substring(1)});
    return trf('Floor {n}', {'n': l});
  }

  /// Short, readable facts like "♿ Wheelchair access" or "📶 Wi-Fi".
  List<String> get labels => _labels.map(tr).toList();

  List<String> get _labels => [
        if (wheelchair == 'yes') '♿ Wheelchair access',
        if (wheelchair == 'limited') '♿ Limited wheelchair access',
        if (wheelchair == 'no') '♿ No wheelchair access',
        if (wifi == true) '📶 Wi-Fi',
        if (outdoorSeating == true) '🌤️ Outdoor seating',
        if (airConditioning == true) '❄️ Air conditioned',
        if (shisha == true) '💨 Shisha',
        if (smoking == 'no') '🚭 No smoking',
        if (smoking == 'outside') '🚬 Smoking outside only',
        if (smoking == 'yes' || smoking == 'separated' || smoking == 'isolated') '🚬 Smoking area',
        if (vegetarian == 'only') '🥗 Vegetarian only',
        if (vegetarian == 'yes' || vegetarian == 'limited') '🥗 Vegetarian options',
        if (delivery == true) '🛵 Delivery',
        if (takeaway == 'yes' || takeaway == 'only') '🥡 Takeaway',
        if (cards == true) '💳 Cards accepted',
        if (cards == false) '💵 Cash only',
        if (reservation == 'required') '📅 Booking required',
        if (reservation == 'recommended') '📅 Booking recommended',
        if (reservation == 'yes') '📅 Takes bookings',
        if (kidsArea == true) '🧸 Kids area',
        if (halal == true) '🥩 Halal',
      ];
}

/// Human-friendly labels and icons for place categories.
class Categories {
  Categories._();

  static const all = <String, String>{
    'restaurant': 'Restaurants',
    'cafe': 'Cafés',
    'cinema': 'Cinemas',
    'mall': 'Malls',
    'shop': 'Shops',
    'escape_room': 'Escape rooms',
    'entertainment': 'Fun & games',
    'park': 'Parks',
    'museum': 'Culture',
    'sight': 'Sights',
    'activity': 'Activities',
  };

  static String label(String category) => tr(all[category] ?? category.replaceAll('_', ' '));

  /// A hue (0–360) per kind of place, for colorful headers without photos.
  static double hue(String category) => switch (category) {
        'restaurant' => 14,
        'cafe' => 30,
        'cinema' => 270,
        'mall' => 320,
        'shop' => 300,
        'escape_room' => 250,
        'entertainment' => 200,
        'park' => 120,
        'museum' => 45,
        'sight' => 40,
        'activity' => 180,
        _ => 210,
      };

  static String emoji(String category) => switch (category) {
        'restaurant' => '🍽️',
        'cafe' => '☕',
        'cinema' => '🎬',
        'mall' => '🛍️',
        'shop' => '👜',
        'escape_room' => '🔐',
        'entertainment' => '🎳',
        'park' => '🌳',
        'museum' => '🏛️',
        'sight' => '🕌',
        'activity' => '🎯',
        _ => '📍',
      };
}
