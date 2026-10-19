import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/place.dart';
import '../models/review.dart';

/// Khroga reviews. Every write is one transaction that also updates the
/// place's stars and your reviewer numbers; firestore.rules checks the maths.
/// Reads are small and on request (no live listeners on reviews).
class ReviewsRepository {
  ReviewsRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> get _reviews => _db.collection('reviews');
  DocumentReference<Map<String, dynamic>> _placeStats(String placeId) =>
      _db.collection('placeStats').doc(placeId);
  DocumentReference<Map<String, dynamic>> _reviewerStats(String uid) =>
      _db.collection('reviewerStats').doc(uid);

  Future<PlaceStats> placeStats(String placeId) async =>
      PlaceStats.fromMap((await _placeStats(placeId).get()).data());

  Future<ReviewerStats> reviewerStats(String uid) async =>
      ReviewerStats.fromMap((await _reviewerStats(uid).get()).data());

  /// Reviewer numbers for several people (for levels next to their names).
  Future<Map<String, ReviewerStats>> reviewerStatsFor(Iterable<String> uids) async {
    final ids = uids.toSet().toList();
    final out = <String, ReviewerStats>{};
    for (var i = 0; i < ids.length; i += 30) {
      final snap = await _db
          .collection('reviewerStats')
          .where(FieldPath.documentId, whereIn: ids.sublist(i, (i + 30).clamp(0, ids.length)))
          .get();
      for (final d in snap.docs) {
        out[d.id] = ReviewerStats.fromMap(d.data());
      }
    }
    return out;
  }

  Future<Review?> myReview(String placeId, String uid) async {
    final d = await _reviews.doc(Review.docId(placeId, uid)).get();
    return d.exists ? Review.fromMap(d.data()!) : null;
  }

  /// The newest [limit] reviews of a place (sorted on the phone, so no extra
  /// database index is needed).
  Future<List<Review>> latest(String placeId, {int limit = 20}) async {
    final snap = await _reviews.where('placeId', isEqualTo: placeId).limit(limit).get();
    return snap.docs.map((d) => Review.fromMap(d.data())).toList()
      ..sort((a, b) => (b.updatedAt ?? DateTime(0)).compareTo(a.updatedAt ?? DateTime(0)));
  }

  /// Your reviews, newest first.
  Future<List<Review>> mine(String uid, {int limit = 100}) async {
    final snap = await _reviews.where('uid', isEqualTo: uid).limit(limit).get();
    return snap.docs.map((d) => Review.fromMap(d.data())).toList()
      ..sort((a, b) => (b.updatedAt ?? DateTime(0)).compareTo(a.updatedAt ?? DateTime(0)));
  }

  /// Writes (or changes) your review. Returns your numbers before and after.
  Future<(ReviewerStats, ReviewerStats)> save({
    required String uid,
    required String name,
    required Place place,
    required int stars,
    required String text,
    required Map<String, String> answers,
  }) {
    final ref = _reviews.doc(Review.docId(place.id, uid));
    return _db.runTransaction((tx) async {
      final old = await tx.get(ref);
      final ps = await tx.get(_placeStats(place.id));
      final rs = await tx.get(_reviewerStats(uid));
      final before = old.exists ? Review.fromMap(old.data()!) : null;
      final cleanText = text.trim();
      final after = Review(
        placeId: place.id,
        uid: uid,
        name: name.length > 40 ? name.substring(0, 40) : name,
        stars: stars.clamp(1, 5),
        category: before?.category ?? place.category,
        text: cleanText.length > 1000 ? cleanText.substring(0, 1000) : cleanText,
        answers: Map.fromEntries(answers.entries.take(20)),
      );
      final mineBefore = ReviewerStats.fromMap(rs.data());
      final (placeNext, mineNext) = statsAfter(PlaceStats.fromMap(ps.data()), mineBefore, before, after);
      tx.set(ref, {
        'placeId': after.placeId,
        'uid': uid,
        'name': after.name,
        'stars': after.stars,
        'text': after.text,
        'answers': after.answers,
        'category': after.category,
        'createdAt': before == null ? FieldValue.serverTimestamp() : old.data()!['createdAt'],
        'updatedAt': FieldValue.serverTimestamp(),
      });
      tx.set(_placeStats(place.id), placeNext.toMap());
      tx.set(_reviewerStats(uid), mineNext.toMap(place: place.id));
      return (mineBefore, mineNext);
    });
  }

  Future<void> delete(String uid, String placeId) {
    final ref = _reviews.doc(Review.docId(placeId, uid));
    return _db.runTransaction((tx) async {
      final old = await tx.get(ref);
      if (!old.exists) return;
      final ps = await tx.get(_placeStats(placeId));
      final rs = await tx.get(_reviewerStats(uid));
      final (placeNext, mineNext) = statsAfter(
          PlaceStats.fromMap(ps.data()), ReviewerStats.fromMap(rs.data()), Review.fromMap(old.data()!), null);
      tx.delete(ref);
      tx.set(_placeStats(placeId), placeNext.toMap());
      tx.set(_reviewerStats(uid), mineNext.toMap(place: placeId));
    });
  }

  /// "Delete my account": removes all your reviews (fixing each place's
  /// stars), then your reviewer numbers.
  /// Your friends' newest reviews: up to 30 friends, 20 reviews, newest
  /// first (uses the reviews(uid, updatedAt) index).
  Future<List<Review>> friendsLatest(List<String> uids, {int limit = 20}) async {
    if (uids.isEmpty) return const [];
    final snap = await _reviews
        .where('uid', whereIn: uids.take(30).toList())
        .orderBy('updatedAt', descending: true)
        .limit(limit)
        .get();
    return snap.docs.map((d) => Review.fromMap(d.data())).toList();
  }

  // ---- "Helpful" votes ----
  CollectionReference<Map<String, dynamic>> _helpful(String reviewId) =>
      _reviews.doc(reviewId).collection('helpful');

  /// How many found a review helpful, and whether you did (2 small reads).
  Future<(int, bool)> helpful(String reviewId, String? uid) async {
    final count = (await _helpful(reviewId).count().get()).count ?? 0;
    final mine = uid != null && (await _helpful(reviewId).doc(uid).get()).exists;
    return (count, mine);
  }

  Future<void> setHelpful(String reviewId, String uid, bool on) {
    final batch = _db.batch();
    final given = _db.collection('users').doc(uid).collection('helpfulGiven').doc(reviewId);
    if (on) {
      batch
        ..set(_helpful(reviewId).doc(uid), {'at': FieldValue.serverTimestamp()})
        ..set(given, {'at': FieldValue.serverTimestamp()});
    } else {
      batch
        ..delete(_helpful(reviewId).doc(uid))
        ..delete(given);
    }
    return batch.commit();
  }

  /// Removes every "helpful" vote you gave (used by Delete my account).
  Future<void> deleteMyHelpful(String uid) async {
    final given = _db.collection('users').doc(uid).collection('helpfulGiven');
    while (true) {
      final page = await given.limit(200).get();
      if (page.docs.isEmpty) break;
      final batch = _db.batch();
      for (final d in page.docs) {
        batch
          ..delete(_helpful(d.id).doc(uid))
          ..delete(d.reference);
      }
      await batch.commit();
    }
  }

  Future<void> deleteAllMine(String uid) async {
    while (true) {
      final batch = await _reviews.where('uid', isEqualTo: uid).limit(50).get();
      if (batch.docs.isEmpty) break;
      for (final d in batch.docs) {
        await delete(uid, (d.data()['placeId'] as String?) ?? '');
      }
    }
    final rs = await _reviewerStats(uid).get();
    if (rs.exists && ReviewerStats.fromMap(rs.data()).total == 0) await _reviewerStats(uid).delete();
  }

  /// The most-reviewed places (one small query, read when the page opens).
  Future<List<(String, PlaceStats)>> mostReviewed({int limit = 40}) async {
    final snap = await _db.collection('placeStats').orderBy('count', descending: true).limit(limit).get();
    return [for (final d in snap.docs) (d.id, PlaceStats.fromMap(d.data()))];
  }

  /// The newest reviews anywhere.
  Future<List<Review>> newest({int limit = 15}) async {
    final snap = await _reviews.orderBy('updatedAt', descending: true).limit(limit).get();
    return snap.docs.map((d) => Review.fromMap(d.data())).toList();
  }

  /// Your reviews since [since] (this week's challenge): small and cheap.
  Future<List<Review>> mineSince(String uid, DateTime since) async {
    final snap = await _reviews
        .where('uid', isEqualTo: uid)
        .where('updatedAt', isGreaterThanOrEqualTo: Timestamp.fromDate(since))
        .orderBy('updatedAt', descending: true)
        .limit(20)
        .get();
    return snap.docs.map((d) => Review.fromMap(d.data())).toList();
  }
}
