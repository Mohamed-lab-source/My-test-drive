import 'package:cloud_firestore/cloud_firestore.dart';

/// What the person asked for when generating a plan.
class PlanRequest {
  const PlanRequest({
    required this.city,
    required this.groupSize,
    required this.vibes,
    required this.timeOfDay,
    this.budgetPerPerson,
    this.stops = 3,
    this.mallId,
    this.notes,
    this.excludePlaceIds = const [],
  });

  final String city;
  final int groupSize;
  final List<String> vibes;
  final String timeOfDay;
  final int? budgetPerPerson;
  final int stops;
  final String? mallId;
  final String? notes;

  /// Places to avoid, so "Give me another one" really gives something new.
  final List<String> excludePlaceIds;

  Map<String, dynamic> toMap() => {
        'city': city,
        'groupSize': groupSize,
        'vibes': vibes,
        'timeOfDay': timeOfDay,
        'budgetPerPerson': budgetPerPerson,
        'stops': stops,
        'mallId': mallId,
        'notes': notes,
        'excludePlaceIds': excludePlaceIds,
      };

  factory PlanRequest.fromMap(Map<String, dynamic> m) => PlanRequest(
        city: (m['city'] as String?) ?? 'cairo',
        groupSize: (m['groupSize'] as num?)?.toInt() ?? 2,
        vibes: ((m['vibes'] as List?) ?? const []).whereType<String>().toList(),
        timeOfDay: (m['timeOfDay'] as String?) ?? 'evening',
        budgetPerPerson: (m['budgetPerPerson'] as num?)?.toInt(),
        stops: (m['stops'] as num?)?.toInt() ?? 3,
        mallId: m['mallId'] as String?,
        notes: m['notes'] as String?,
        excludePlaceIds: ((m['excludePlaceIds'] as List?) ?? const [])
            .whereType<String>()
            .toList(),
      );

  PlanRequest copyWith({List<String>? excludePlaceIds}) => PlanRequest(
        city: city,
        groupSize: groupSize,
        vibes: vibes,
        timeOfDay: timeOfDay,
        budgetPerPerson: budgetPerPerson,
        stops: stops,
        mallId: mallId,
        notes: notes,
        excludePlaceIds: excludePlaceIds ?? this.excludePlaceIds,
      );
}

/// A generated outing plan. Every stop points at a real place from our data.
class OutingPlan {
  const OutingPlan({
    required this.id,
    required this.title,
    required this.summary,
    required this.stops,
    required this.request,
    this.tips = const [],
    this.weatherNote,
    this.source = 'ai',
    this.saved = false,
    this.createdAt,
  });

  final String id;
  final String title;
  final String summary;
  final List<PlanStop> stops;
  final PlanRequest request;
  final List<String> tips;
  final String? weatherNote;

  /// 'ai' when Gemini wrote it, 'fallback' when the app built it alone.
  final String source;
  final bool saved;
  final DateTime? createdAt;

  bool get isMallLocked => request.mallId != null && request.mallId!.isNotEmpty;

  /// Fields to store in Firestore (createdAt is added by the repository).
  Map<String, dynamic> toMap() => {
        'title': title,
        'summary': summary,
        'stops': stops.map((s) => s.toMap()).toList(),
        'request': request.toMap(),
        'tips': tips,
        'weatherNote': weatherNote,
        'source': source,
        'saved': saved,
      };

  factory OutingPlan.fromMap(String id, Map<String, dynamic> m) => OutingPlan(
        id: id,
        title: (m['title'] as String?) ?? 'Your outing',
        summary: (m['summary'] as String?) ?? '',
        stops: ((m['stops'] as List?) ?? const [])
            .whereType<Map>()
            .map((s) => PlanStop.fromMap(Map<String, dynamic>.from(s)))
            .toList(),
        request: PlanRequest.fromMap(
            Map<String, dynamic>.from((m['request'] as Map?) ?? const {})),
        tips: ((m['tips'] as List?) ?? const []).whereType<String>().toList(),
        weatherNote: m['weatherNote'] as String?,
        source: (m['source'] as String?) ?? 'ai',
        saved: (m['saved'] as bool?) ?? false,
        createdAt: (m['createdAt'] as Timestamp?)?.toDate(),
      );
}

/// One stop in a plan. Place facts are copied from our data when the plan is
/// made; [why] and timing come from the planner.
class PlanStop {
  const PlanStop({
    required this.placeId,
    required this.name,
    required this.category,
    this.area,
    this.lat,
    this.lng,
    this.cuisine,
    this.startTime,
    this.durationMinutes,
    this.why,
    this.kmFromPrevious,
  });

  final String placeId;
  final String name;
  final String category;
  final String? area;
  final double? lat;
  final double? lng;
  final String? cuisine;
  final String? startTime;
  final int? durationMinutes;
  final String? why;

  /// Straight-line distance from the previous stop, computed from real
  /// coordinates. Null when either stop has no coordinates on file.
  final double? kmFromPrevious;

  bool get hasLocation => lat != null && lng != null;

  Map<String, dynamic> toMap() => {
        'placeId': placeId,
        'name': name,
        'category': category,
        'area': area,
        'lat': lat,
        'lng': lng,
        'cuisine': cuisine,
        'startTime': startTime,
        'durationMinutes': durationMinutes,
        'why': why,
        'kmFromPrevious': kmFromPrevious,
      };

  factory PlanStop.fromMap(Map<String, dynamic> m) => PlanStop(
        placeId: (m['placeId'] as String?) ?? '',
        name: (m['name'] as String?) ?? '',
        category: (m['category'] as String?) ?? 'other',
        area: m['area'] as String?,
        lat: (m['lat'] as num?)?.toDouble(),
        lng: (m['lng'] as num?)?.toDouble(),
        cuisine: m['cuisine'] as String?,
        startTime: m['startTime'] as String?,
        durationMinutes: (m['durationMinutes'] as num?)?.toInt(),
        why: m['why'] as String?,
        kmFromPrevious: (m['kmFromPrevious'] as num?)?.toDouble(),
      );
}

class Vibes {
  Vibes._();
  static const all = <String, String>{
    'chill': '😌 Chill',
    'foodie': '🍕 Foodie',
    'active': '⚡ Active',
    'romantic': '💕 Date',
    'family': '👨‍👩‍👧 Family',
    'culture': '🏛️ Culture',
    'shopping': '🛍️ Shopping',
    'nightlife': '🌙 Night out',
  };
}

class Cities {
  Cities._();
  static const all = <String, String>{
    'cairo': 'Cairo',
    'giza': 'Giza',
    'alexandria': 'Alexandria',
  };
}

class TimesOfDay {
  TimesOfDay._();
  static const all = <String, String>{
    'morning': 'Morning',
    'afternoon': 'Afternoon',
    'evening': 'Evening',
    'night': 'Late night',
  };
}
