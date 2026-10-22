import 'package:cloud_firestore/cloud_firestore.dart';

import '../app/live.dart';

/// Live location in a group: `groups/{id}/live/{uid}`. Only members can read
/// it, each person writes only their own spot, and it stops by itself
/// (firestore.rules allows at most 4 hours ahead).
class LiveRepository {
  LiveRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _live(String groupId) =>
      _db.collection('groups').doc(groupId).collection('live');

  /// Everyone sharing in a group (groups are small; 30 is plenty).
  Stream<List<LiveSpot>> watch(String groupId) => _live(groupId).limit(30).snapshots().map((s) => [
        for (final d in s.docs) ?LiveSpot.fromMap(d.id, d.data()),
      ]);

  Future<void> share({
    required String groupId,
    required String uid,
    required String name,
    required double lat,
    required double lng,
    required DateTime until,
    String? status,
  }) =>
      _live(groupId).doc(uid).set({
        'lat': lat,
        'lng': lng,
        'name': name.length > 40 ? name.substring(0, 40) : name,
        'updatedAt': FieldValue.serverTimestamp(),
        'until': Timestamp.fromDate(until),
        'status': status,
      });

  Future<void> stop(String groupId, String uid) => _live(groupId).doc(uid).delete();

  /// Removes your spot from every one of these groups (stopping, leaving,
  /// deleting your account, or an old spot left behind).
  Future<void> stopAll(String uid, Iterable<String> groupIds) =>
      Future.wait([for (final g in groupIds) stop(g, uid).catchError((_) {})]);
}
