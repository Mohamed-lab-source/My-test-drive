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

  Stream<List<String>> watchVisited(String uid) => _visited(uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map((d) => d.id).toList());

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
}
