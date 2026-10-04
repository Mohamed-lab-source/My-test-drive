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
    this.area,
    this.address,
    this.lat,
    this.lng,
    this.cuisine,
    this.openingHours,
    this.parentMallId,
    this.website,
    this.phone,
    this.indoor,
    this.osmUrl,
    this.quality = 0,
  });

  final String id;
  final String name;
  final String category;
  final String city;
  final String? nameAr;

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
  final bool? indoor;

  /// Link to this place on openstreetmap.org (for attribution and fixes).
  final String? osmUrl;

  /// How complete the map entry is (website, hours, phone...). Used only to
  /// rank places; never shown as a rating.
  final int quality;

  bool get hasLocation => lat != null && lng != null;

  String? get cuisineLabel => cuisine
      ?.split(';')
      .map((c) => c.trim().replaceAll('_', ' '))
      .where((c) => c.isNotEmpty)
      .take(3)
      .join(', ');

  factory Place.fromMap(Map<String, dynamic> m) {
    return Place(
      id: (m['id'] as String?) ?? '',
      name: (m['name'] as String?) ?? 'Unnamed place',
      category: (m['category'] as String?) ?? 'other',
      city: (m['city'] as String?) ?? '',
      nameAr: m['nameAr'] as String?,
      area: m['area'] as String?,
      address: m['address'] as String?,
      lat: (m['lat'] as num?)?.toDouble(),
      lng: (m['lng'] as num?)?.toDouble(),
      cuisine: m['cuisine'] as String?,
      openingHours: m['openingHours'] as String?,
      parentMallId: m['parentMallId'] as String?,
      website: m['website'] as String?,
      phone: m['phone'] as String?,
      indoor: m['indoor'] as bool?,
      osmUrl: m['osmUrl'] as String?,
      quality: (m['quality'] as num?)?.toInt() ?? 0,
    );
  }
}

/// Human-friendly labels and icons for place categories.
class Categories {
  Categories._();

  static const all = <String, String>{
    'restaurant': 'Restaurants',
    'cafe': 'Cafés',
    'cinema': 'Cinemas',
    'mall': 'Malls',
    'escape_room': 'Escape rooms',
    'entertainment': 'Fun & games',
    'park': 'Parks',
    'museum': 'Culture',
    'activity': 'Activities',
  };

  static String label(String category) =>
      all[category] ?? category.replaceAll('_', ' ');

  static String emoji(String category) => switch (category) {
        'restaurant' => '🍽️',
        'cafe' => '☕',
        'cinema' => '🎬',
        'mall' => '🛍️',
        'escape_room' => '🔐',
        'entertainment' => '🎳',
        'park' => '🌳',
        'museum' => '🏛️',
        'activity' => '🎯',
        _ => '📍',
      };
}
