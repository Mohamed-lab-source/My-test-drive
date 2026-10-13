import 'package:cloud_firestore/cloud_firestore.dart';

/// Your own place history: places you've been to and private notes.
/// Saved to your account, visible only to you.
class PersonalRepository {
  PersonalRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _visited(String uid) =>
      _db.collection('users').doc(uid).collection('visited');
  CollectionReference<Map<String, dynamic>> _notes(String uid) =>
      _db.collection('users').doc(uid).collection('notes');

  /// Places you've been, newest first, with when you marked them.
  Stream<List<(String, DateTime?)>> watchVisited(String uid) => _visited(uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => [for (final d in s.docs) (d.id, (d.data()['createdAt'] as Timestamp?)?.toDate())]);

  Future<void> setVisited(String uid, String placeId, bool visited) => visited
      ? _visited(uid).doc(placeId).set({'createdAt': FieldValue.serverTimestamp()})
      : _visited(uid).doc(placeId).delete();

  Stream<String?> watchNote(String uid, String placeId) => _notes(uid)
      .doc(placeId)
      .snapshots()
      .map((d) => d.data()?['text'] as String?);

  Future<void> saveNote(String uid, String placeId, String text) {
    final t = text.trim();
    if (t.isEmpty) return _notes(uid).doc(placeId).delete();
    return _notes(uid).doc(placeId).set({
      'text': t.length > 500 ? t.substring(0, 500) : t,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  /// Your newest private notes (one read, not a listener), for the Notes page.
  Future<List<({String placeId, String text, DateTime? updatedAt})>> allNotes(String uid,
      {int limit = 100}) async {
    final snap = await _notes(uid).orderBy('updatedAt', descending: true).limit(limit).get();
    return [
      for (final d in snap.docs)
        (
          placeId: d.id,
          text: (d.data()['text'] as String?) ?? '',
          updatedAt: (d.data()['updatedAt'] as Timestamp?)?.toDate(),
        ),
    ];
  }
}
