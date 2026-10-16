import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/crowd.dart';

/// Thrown when you reported this place less than 30 minutes ago.
class CrowdTooSoon implements Exception {
  const CrowdTooSoon(this.minutes);
  final int minutes;
}

/// Live "how busy is it" reports. One read per place page; a report is one
/// small transaction (the counts + your private "last reported" mark).
class CrowdRepository {
  CrowdRepository(this._db);

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _crowd(String placeId) => _db.collection('crowd').doc(placeId);
  DocumentReference<Map<String, dynamic>> _mark(String uid, String placeId) =>
      _db.collection('users').doc(uid).collection('crowdMarks').doc(placeId);

  Future<CrowdNow> now(String placeId) async => CrowdNow.fromMap((await _crowd(placeId).get()).data());

  Future<void> report(String uid, String placeId, String level) async {
    assert(crowdLevels.containsKey(level));
    Future<void> attempt({bool? forceContinue}) => _db.runTransaction((tx) async {
      final now = DateTime.now();
      final mark = await tx.get(_mark(uid, placeId));
      final left = crowdMinutesLeft((mark.data()?['at'] as Timestamp?)?.toDate(), now);
      if (left > 0) throw CrowdTooSoon(left);
      final snap = await tx.get(_crowd(placeId));
      final current = snap.exists ? CrowdNow.fromMap(snap.data()) : null;
      final continues = snap.exists && (forceContinue ?? crowdContinues(current, now));
      tx.set(_crowd(placeId), {
        ...crowdCountsAfter(current, level, continues: continues),
        'since': continues ? snap.data()!['since'] : FieldValue.serverTimestamp(),
        'last': FieldValue.serverTimestamp(),
      });
      tx.set(_mark(uid, placeId), {'at': FieldValue.serverTimestamp()});
    });
    try {
      await attempt();
    } on FirebaseException catch (e) {
      // Right at the 2-hour edge the phone's clock and the server can
      // disagree on whether a new window starts: try the other way once.
      if (e.code != 'permission-denied') rethrow;
      final snap = await _crowd(placeId).get();
      if (!snap.exists) rethrow;
      final current = CrowdNow.fromMap(snap.data());
      await attempt(forceContinue: !crowdContinues(current, DateTime.now()));
    }
  }
}
