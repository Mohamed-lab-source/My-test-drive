import 'package:cloud_firestore/cloud_firestore.dart';

/// Favorite places (just their ids), saved to the person's account.
class FavoritesRepository {
  FavoritesRepository(this._db);

  final FirebaseFirestore _db;

  CollectionReference<Map<String, dynamic>> _favs(String uid) =>
      _db.collection('users').doc(uid).collection('favorites');

  /// Place ids, newest first.
  Stream<List<String>> watch(String uid) => _favs(uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map((d) => d.id).toList());

  Future<void> set(String uid, String placeId, bool favorite) => favorite
      ? _favs(uid).doc(placeId).set({'createdAt': FieldValue.serverTimestamp()})
      : _favs(uid).doc(placeId).delete();
}
