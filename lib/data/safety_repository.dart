import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/review.dart';
import '../models/social.dart';
import 'groups_repository.dart';
import 'reviews_repository.dart';

/// Reports, feedback, error reports and "Delete my account".
/// Reports/feedback/errors are write-only: the owner reads them in the
/// Firebase console, nobody can read them from the app.
class SafetyRepository {
  SafetyRepository(this._db, this._groups, this._reviews);

  final FirebaseFirestore _db;
  final GroupsRepository _groups;
  final ReviewsRepository _reviews;

  Future<void> reportMessage({
    required String by,
    required Group group,
    required GroupMessage message,
    required String reason,
  }) =>
      _db.collection('reports').add({
        'by': by,
        'kind': 'message',
        'targetUid': message.uid,
        'groupId': group.id,
        'messageId': message.id,
        'text': message.text.length > 1000 ? message.text.substring(0, 1000) : message.text,
        'reason': reason,
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> reportReview({required String by, required Review review, required String reason}) =>
      _db.collection('reports').add({
        'by': by,
        'kind': 'review',
        'targetUid': review.uid,
        'placeId': review.placeId,
        'text': review.text,
        'reason': reason,
        'createdAt': FieldValue.serverTimestamp(),
      });

  /// Google Play: people must be able to flag offensive AI-written text.
  Future<void> reportAiText({required String by, required String text, required String reason}) =>
      _db.collection('reports').add({
        'by': by,
        'kind': 'ai',
        'text': text.length > 1000 ? text.substring(0, 1000) : text,
        'reason': reason,
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> reportUser({required String by, required String targetUid, required String reason}) =>
      _db.collection('reports').add({
        'by': by,
        'kind': 'user',
        'targetUid': targetUid,
        'reason': reason,
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> sendFeedback({required String by, required String text, required String version}) =>
      _db.collection('feedback').add({
        'by': by,
        'text': text.length > 1000 ? text.substring(0, 1000) : text,
        'appVersion': version,
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> sendError({
    required String by,
    required String message,
    required String stack,
    required String version,
  }) =>
      _db.collection('errorReports').add({
        'by': by,
        'message': message.length > 500 ? message.substring(0, 500) : message,
        'stack': stack.length > 4000 ? stack.substring(0, 4000) : stack,
        'appVersion': version,
        'createdAt': FieldValue.serverTimestamp(),
      });

  /// Deletes everything this person has in Khroga: plans, favorites, notes,
  /// "been there", check-in, friendships, username, profile. Groups they run
  /// are deleted; other groups they simply leave.
  Future<void> deleteAllData(String uid, {String? username}) async {
    await _reviews.deleteMyHelpful(uid);
    await _reviews.deleteAllMine(uid);
    final groups = await _db.collection('groups').where('memberUids', arrayContains: uid).get();
    for (final d in groups.docs) {
      final g = Group.fromMap(d.id, d.data());
      if (!g.isOwner(uid)) {
        // Your own orders in that group's bill go too.
        final orders = await d.reference.collection('orders').where('uid', isEqualTo: uid).limit(200).get();
        for (final o in orders.docs) {
          await o.reference.delete();
        }
      }
      g.isOwner(uid) ? await _groups.delete(g) : await _groups.leave(g.id, uid);
    }
    final friendships = await _db.collection('friendships').where('uids', arrayContains: uid).get();
    for (final d in friendships.docs) {
      await d.reference.delete();
    }
    final user = _db.collection('users').doc(uid);
    for (final sub in ['plans', 'favorites', 'visited', 'notes', 'crowdMarks']) {
      while (true) {
        final page = await user.collection(sub).limit(400).get();
        if (page.docs.isEmpty) break;
        final batch = _db.batch();
        for (final d in page.docs) {
          batch.delete(d.reference);
        }
        await batch.commit();
      }
    }
    final batch = _db.batch()
      ..delete(_db.collection('checkins').doc(uid))
      ..delete(user)
      ..delete(_db.collection('publicProfiles').doc(uid));
    if (username != null) batch.delete(_db.collection('usernames').doc(username));
    await batch.commit();
  }
}
