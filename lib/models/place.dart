/// A real place from Khroga's database.
///
/// Every field comes from real sources only: Khroga's research, Google Places,
/// or user submissions. Fields we don't know are `null` — never guessed.
class Place {
  const Place({
    required this.id,
    required this.name,
    required this.category,
    required this.city,
    this.area,
    this.address,
    this.lat,
    this.lng,
    this.googlePlaceId,
    this.rating,
    this.ratingCount,
    this.priceLevel,
    this.avgCostPerPerson,
    this.photos = const [],
    this.openingHours = const [],
    this.parentMallId,
    this.website,
    this.phone,
    this.indoor,
  });

  final String id;
  final String name;
  final String category;
  final String city;
  final String? area;
  final String? address;
  final double? lat;
  final double? lng;
  final String? googlePlaceId;
  final double? rating;
  final int? ratingCount;

  /// Google's price level, 0 (free) to 4 (very expensive). Real, from Google.
  final int? priceLevel;

  /// Average cost per person in EGP. Only ever set from user submissions.
  final num? avgCostPerPerson;
  final List<PlacePhoto> photos;

  /// Opening hours as Google words them, e.g. "Monday: 10:00 AM – 11:00 PM".
  final List<String> openingHours;
  final String? parentMallId;
  final String? website;
  final String? phone;
  final bool? indoor;

  bool get hasLocation => lat != null && lng != null;

  String get priceLabel =>
      priceLevel == null ? '' : (priceLevel == 0 ? 'Free' : r'$' * priceLevel!);

  factory Place.fromMap(String id, Map<String, dynamic> m) {
    return Place(
      id: id,
      name: (m['name'] as String?) ?? 'Unnamed place',
      category: (m['category'] as String?) ?? 'other',
      city: (m['city'] as String?) ?? '',
      area: m['area'] as String?,
      address: m['address'] as String?,
      lat: (m['lat'] as num?)?.toDouble(),
      lng: (m['lng'] as num?)?.toDouble(),
      googlePlaceId: m['googlePlaceId'] as String?,
      rating: (m['rating'] as num?)?.toDouble(),
      ratingCount: (m['ratingCount'] as num?)?.toInt(),
      priceLevel: (m['priceLevel'] as num?)?.toInt(),
      avgCostPerPerson: m['avgCostPerPerson'] as num?,
      photos: ((m['photos'] as List?) ?? const [])
          .whereType<Map>()
          .map((p) => PlacePhoto.fromMap(Map<String, dynamic>.from(p)))
          .where((p) => p.url != null || p.name != null)
          .toList(),
      openingHours:
          ((m['openingHours'] as List?) ?? const []).whereType<String>().toList(),
      parentMallId: m['parentMallId'] as String?,
      website: m['website'] as String?,
      phone: m['phone'] as String?,
      indoor: m['indoor'] as bool?,
    );
  }
}

/// A photo of a place. Either a stored [url], or a Google Places photo
/// resource [name] that the server turns into a viewable link.
class PlacePhoto {
  const PlacePhoto({this.url, this.name, this.attribution});

  final String? url;
  final String? name;
  final String? attribution;

  factory PlacePhoto.fromMap(Map<String, dynamic> m) => PlacePhoto(
        url: m['url'] as String?,
        name: m['name'] as String?,
        attribution: m['attribution'] as String?,
      );
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
