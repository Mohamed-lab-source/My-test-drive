import 'package:cloud_firestore/cloud_firestore.dart';

import '../app/i18n.dart';

/// Reviews written by Khroga users: stars, a few quick questions about the
/// place, and optional words. They are real people's opinions, always shown
/// as "Khroga reviews" and never mixed with map facts or turned into prices.
class Review {
  const Review({
    required this.placeId,
    required this.uid,
    required this.name,
    required this.stars,
    required this.category,
    this.text = '',
    this.answers = const {},
    this.createdAt,
    this.updatedAt,
  });

  final String placeId;
  final String uid;
  final String name;
  final int stars;
  final String category;
  final String text;

  /// Question key → answer key (several answers joined with ",").
  final Map<String, String> answers;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  static String docId(String placeId, String uid) => '${placeId}__$uid';

  /// A thorough review (3+ answers and some words) earns extra points.
  /// (Text is trimmed before saving, so the security rules can count it.)
  bool get isDetailed => answers.length >= 3 && text.length >= 50;

  int get points => reviewPoints(this);

  factory Review.fromMap(Map<String, dynamic> m) => Review(
        placeId: (m['placeId'] as String?) ?? '',
        uid: (m['uid'] as String?) ?? '',
        name: (m['name'] as String?) ?? '',
        stars: ((m['stars'] as num?)?.toInt() ?? 0).clamp(1, 5),
        category: (m['category'] as String?) ?? 'other',
        text: (m['text'] as String?) ?? '',
        answers: {
          for (final e in ((m['answers'] as Map?) ?? const {}).entries)
            if (e.key is String && e.value is String) e.key as String: e.value as String,
        },
        createdAt: (m['createdAt'] as Timestamp?)?.toDate(),
        updatedAt: (m['updatedAt'] as Timestamp?)?.toDate(),
      );
}

/// 10 points for a review, 10 more when it's detailed.
int reviewPoints(Review r) => 10 + (r.isDetailed ? 10 : 0);

/// One quick question. [options] are answer key → English label.
class ReviewQuestion {
  const ReviewQuestion(this.key, this._text, this.options, {this.multi = false});
  final String key;
  final String _text;
  String get text => tr(_text);
  final Map<String, String> options;
  final bool multi;
}

const _yesNo = {'yes': 'Yes', 'no': 'No'};
const _quality = {'great': 'Great', 'good': 'Good', 'ok': 'OK', 'poor': 'Poor'};

const _common = [
  ReviewQuestion('again', 'Would you go again?', _yesNo),
  ReviewQuestion('crowd', 'How busy was it?', {'quiet': 'Quiet', 'normal': 'Normal', 'busy': 'Busy'}),
  ReviewQuestion('clean', 'How clean was it?', _quality),
  ReviewQuestion('value', 'Worth what you paid?', {'yes': 'Yes', 'fair': 'Fair', 'no': 'No'}),
  ReviewQuestion('goodFor', 'Good for…', {
    'friends': 'Friends',
    'family': 'Family',
    'kids': 'Kids',
    'dates': 'Dates',
    'solo': 'Going alone',
    'work': 'Working or studying',
  }, multi: true),
];

const _food = [
  ReviewQuestion('taste', 'How was the food or drinks?', _quality),
  ReviewQuestion('service', 'How was the service?', _quality),
  ReviewQuestion('wait', 'How long did you wait?', {'short': 'Short', 'ok': 'OK', 'long': 'Long'}),
  ReviewQuestion('portion', 'Portion size', {'small': 'Small', 'fair': 'Fair', 'big': 'Big'}),
  ReviewQuestion('wifi', 'Did the Wi-Fi work?', {'yes': 'Yes', 'no': 'No', 'none': 'No Wi-Fi'}),
  ReviewQuestion('noise', 'How loud was it?', {'calm': 'Calm', 'normal': 'Normal', 'loud': 'Loud'}),
];

const _fun = [
  ReviewQuestion('fun', 'How fun was it?', _quality),
  ReviewQuestion('staff', 'How were the staff?', _quality),
  ReviewQuestion('booking', 'Did you need to book?', {'yes': 'Yes', 'no': 'No'}),
];

const _cinema = [
  ReviewQuestion('screen', 'Picture and sound', _quality),
  ReviewQuestion('seats', 'Seats', _quality),
  ReviewQuestion('staff', 'How were the staff?', _quality),
];

const _culture = [
  ReviewQuestion('worth', 'Worth the visit?', _quality),
  ReviewQuestion('time', 'How long did you stay?', {'short': 'Under 1 hour', 'mid': '1–2 hours', 'long': 'More than 2 hours'}),
  ReviewQuestion('info', 'Signs and information', _quality),
  ReviewQuestion('access', 'Easy to walk around?', _yesNo),
];

const _park = [
  ReviewQuestion('shade', 'Enough shade and seats?', _yesNo),
  ReviewQuestion('safe', 'Felt safe?', _yesNo),
  ReviewQuestion('toilets', 'Clean toilets?', {'yes': 'Yes', 'no': 'No', 'none': 'None found'}),
];

const _mall = [
  ReviewQuestion('parking', 'Parking', {'easy': 'Easy', 'ok': 'OK', 'hard': 'Hard', 'none': 'Didn\'t drive'}),
  ReviewQuestion('toilets', 'Clean toilets?', {'yes': 'Yes', 'no': 'No', 'none': 'None found'}),
  ReviewQuestion('food', 'Good food choices inside?', _yesNo),
];

/// The questions for a kind of place: its own ones first, then common ones.
List<ReviewQuestion> reviewQuestionsFor(String category) => [
      ...switch (category) {
        'restaurant' || 'cafe' => _food,
        'entertainment' || 'escape_room' || 'activity' => _fun,
        'cinema' => _cinema,
        'museum' || 'sight' => _culture,
        'park' => _park,
        'mall' || 'shop' => _mall,
        _ => const <ReviewQuestion>[],
      },
      ..._common,
    ];

/// Your reviewing numbers, kept in `reviewerStats/{uid}` (public, so your
/// level shows next to your reviews; the rules keep them honest).
class ReviewerStats {
  const ReviewerStats({this.total = 0, this.detailed = 0, this.cats = const {}});
  final int total;
  final int detailed;

  /// Category → how many reviews.
  final Map<String, int> cats;

  int get points => total * 10 + detailed * 10;

  factory ReviewerStats.fromMap(Map<String, dynamic>? m) => ReviewerStats(
        total: (m?['total'] as num?)?.toInt() ?? 0,
        detailed: (m?['detailed'] as num?)?.toInt() ?? 0,
        cats: {
          for (final e in ((m?['cats'] as Map?) ?? const {}).entries)
            if (e.key is String && e.value is num) e.key as String: (e.value as num).toInt(),
        },
      );

  /// [place] = the place whose review changes in the same batch (the rules
  /// check the numbers against that review).
  Map<String, dynamic> toMap({required String place}) =>
      {'total': total, 'detailed': detailed, 'cats': cats, 'place': place};
}

/// Place stars, kept in `placeStats/{placeId}`: how many reviews and the
/// sum of their stars.
class PlaceStats {
  const PlaceStats({this.count = 0, this.sum = 0});
  final int count;
  final int sum;
  double? get average => count == 0 ? null : sum / count;

  factory PlaceStats.fromMap(Map<String, dynamic>? m) => PlaceStats(
        count: (m?['count'] as num?)?.toInt() ?? 0,
        sum: (m?['sum'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toMap() => {'count': count, 'sum': sum};
}

/// The numbers after writing, changing or deleting a review ([before] null =
/// new review, [after] null = deleted). The security rules check exactly this.
(PlaceStats, ReviewerStats) statsAfter(PlaceStats place, ReviewerStats me, Review? before, Review? after) {
  final dc = (after == null ? 0 : 1) - (before == null ? 0 : 1);
  final ds = (after?.stars ?? 0) - (before?.stars ?? 0);
  final dd = ((after?.isDetailed ?? false) ? 1 : 0) - ((before?.isDetailed ?? false) ? 1 : 0);
  final cats = {...me.cats};
  final cat = after?.category ?? before?.category;
  if (cat != null && dc != 0) {
    final n = (cats[cat] ?? 0) + dc;
    n <= 0 ? cats.remove(cat) : cats[cat] = n;
  }
  return (
    PlaceStats(count: place.count + dc, sum: place.sum + ds),
    ReviewerStats(total: me.total + dc, detailed: me.detailed + dd, cats: cats),
  );
}

/// A reviewer level, by points.
class GuideTier {
  const GuideTier(this.emoji, this._name, this.minPoints);
  final String emoji;
  final String _name;
  String get name => tr(_name);
  final int minPoints;
}

const guideTiers = [
  GuideTier('🌱', 'Newcomer', 0),
  GuideTier('🧭', 'Explorer', 30),
  GuideTier('📍', 'Local Guide', 100),
  GuideTier('⭐', 'Advanced Guide', 250),
  GuideTier('🏅', 'Top Guide', 500),
  GuideTier('👑', 'Khroga Legend', 1000),
];

GuideTier tierFor(int points) => guideTiers.lastWhere((t) => points >= t.minPoints);

/// The next level and how many points are still needed, or null at the top.
(GuideTier, int)? nextTier(int points) {
  for (final t in guideTiers) {
    if (t.minPoints > points) return (t, t.minPoints - points);
  }
  return null;
}

/// An expert badge for a kind of places.
class ExpertBadge {
  const ExpertBadge(this.emoji, this._name, this.categories, this.needed);
  final String emoji;
  final String _name;
  String get name => tr(_name);
  final Set<String> categories;
  final int needed;
}

const expertBadges = [
  ExpertBadge('🍽️', 'Food expert', {'restaurant', 'cafe'}, 10),
  ExpertBadge('☕', 'Café expert', {'cafe'}, 8),
  ExpertBadge('🎉', 'Fun expert', {'entertainment', 'escape_room', 'activity', 'cinema'}, 8),
  ExpertBadge('🏛️', 'Culture expert', {'museum', 'sight'}, 6),
  ExpertBadge('🛍️', 'Shopping expert', {'mall', 'shop'}, 6),
  ExpertBadge('🌳', 'Outdoors expert', {'park'}, 5),
];

/// How many of your reviews count toward [b].
int reviewsFor(ExpertBadge b, ReviewerStats s) =>
    b.categories.fold(0, (n, c) => n + (s.cats[c] ?? 0));

/// Expert badges you've earned: enough reviews of that kind, and at least
/// half of all your reviews are of that kind (so it means something).
List<ExpertBadge> expertBadgesFor(ReviewerStats s) => [
      for (final b in expertBadges)
        if (reviewsFor(b, s) >= b.needed && reviewsFor(b, s) * 2 >= s.total) b,
    ];

/// "Local Guide · Food expert" (the title shown next to your name).
String guideTitle(ReviewerStats s) {
  final tier = tierFor(s.points);
  final experts = expertBadgesFor(s);
  return [
    '${tier.emoji} ${tier.name}',
    if (experts.isNotEmpty) '${experts.first.emoji} ${experts.first.name}',
  ].join(' · ');
}

/// "8 of 10 would go again"-style summary of the latest reviews' answers to
/// one question: answer key → how many.
Map<String, int> answerCounts(Iterable<Review> reviews, String question) {
  final out = <String, int>{};
  for (final r in reviews) {
    final a = r.answers[question];
    if (a == null) continue;
    for (final part in a.split(',')) {
      if (part.isNotEmpty) out[part] = (out[part] ?? 0) + 1;
    }
  }
  return out;
}
