import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/social.dart';

/// Profiles, usernames and friends.
class SocialRepository {
  SocialRepository(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _profiles =>
      _db.collection('publicProfiles');
  CollectionReference<Map<String, dynamic>> get _friendships =>
      _db.collection('friendships');

  Stream<PublicProfile?> watchProfile(String uid) => _profiles
      .doc(uid)
      .snapshots()
      .map((d) => d.exists ? PublicProfile.fromMap(d.id, d.data()!) : null);

  Future<PublicProfile?> profile(String uid) async {
    final d = await _profiles.doc(uid).get();
    return d.exists ? PublicProfile.fromMap(d.id, d.data()!) : null;
  }

  Future<List<PublicProfile>> profiles(Iterable<String> uids) async {
    final list = uids.toSet().toList();
    final out = <PublicProfile>[];
    // Firestore allows up to 30 ids per "in" query.
    for (var i = 0; i < list.length; i += 30) {
      final chunk = list.sublist(i, i + 30 > list.length ? list.length : i + 30);
      final snap =
          await _profiles.where(FieldPath.documentId, whereIn: chunk).get();
      out.addAll(snap.docs.map((d) => PublicProfile.fromMap(d.id, d.data())));
    }
    return out;
  }

  Future<void> updateDisplayName(String uid, String name) =>
      _profiles.doc(uid).update({'displayName': name.trim()});

  /// Usernames are claimed on the server so two people can never get the same.
  Future<void> claimUsername(String username) => _functions
      .httpsCallable('claimUsername')
      .call<Map<String, dynamic>>({'username': username.trim().toLowerCase()});

  /// Live prefix search by username.
  Future<List<PublicProfile>> searchUsername(String query) async {
    final q = query.trim().toLowerCase().replaceAll('@', '');
    if (q.length < 2) return const [];
    final snap = await _profiles
        .where('username', isGreaterThanOrEqualTo: q)
        .where('username', isLessThan: '$q')
        .limit(20)
        .get();
    return snap.docs.map((d) => PublicProfile.fromMap(d.id, d.data())).toList();
  }

  Stream<List<Friendship>> watchFriendships(String uid) => _friendships
      .where('uids', arrayContains: uid)
      .snapshots()
      .map((s) => s.docs.map((d) => Friendship.fromMap(d.id, d.data())).toList());

  Future<void> sendRequest(String me, String other) async {
    if (me == other) return;
    final ref = _friendships.doc(Friendship.idFor(me, other));
    final existing = await ref.get();
    if (existing.exists) return; // already friends or already requested
    await ref.set({
      'uids': [me, other]..sort(),
      'requestedBy': me,
      'status': 'pending',
      'createdAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> accept(String friendshipId) =>
      _friendships.doc(friendshipId).update({'status': 'accepted'});

  Future<void> remove(String friendshipId) =>
      _friendships.doc(friendshipId).delete();

  /// Saves this device's push token so group messages can notify it.
  Future<void> saveFcmToken(String uid, String token) =>
      _db.collection('users').doc(uid).set({
        'fcmTokens': FieldValue.arrayUnion([token]),
      }, SetOptions(merge: true));
}
