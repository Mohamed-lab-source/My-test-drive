import 'dart:math';

import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/plan.dart';
import '../models/social.dart';

/// Groups work without any paid server: the app writes directly, and
/// firestore.rules decides exactly what each person is allowed to change.
class GroupsRepository {
  GroupsRepository(this._db);

  final FirebaseFirestore _db;
  static const maxMembers = 50;
  static const _codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
  final _random = Random.secure();

  CollectionReference<Map<String, dynamic>> get _groups => _db.collection('groups');
  CollectionReference<Map<String, dynamic>> get _codes => _db.collection('joinCodes');

  Stream<List<Group>> watchMyGroups(String uid) => _groups
      .where('memberUids', arrayContains: uid)
      .snapshots()
      .map((s) => s.docs.map((d) => Group.fromMap(d.id, d.data())).toList()
        ..sort((a, b) => (b.lastMessageAt ?? DateTime(0))
            .compareTo(a.lastMessageAt ?? DateTime(0))));

  Stream<Group?> watch(String groupId) => _groups
      .doc(groupId)
      .snapshots()
      .map((d) => d.exists ? Group.fromMap(d.id, d.data()!) : null);

  String _newCode() =>
      List.generate(6, (_) => _codeAlphabet[_random.nextInt(_codeAlphabet.length)]).join();

  /// Creates a group with a unique invite code. Optionally attaches a plan.
  Future<String> create({
    required String uid,
    required String name,
    OutingPlan? plan,
    DateTime? scheduledAt,
  }) async {
    final groupRef = _groups.doc();
    for (var attempt = 0; attempt < 5; attempt++) {
      final code = _newCode();
      final codeRef = _codes.doc(code);
      final created = await _db.runTransaction<bool>((tx) async {
        if ((await tx.get(codeRef)).exists) return false; // code taken, try another
        tx.set(codeRef, {'groupId': groupRef.id});
        tx.set(groupRef, {
          'name': name,
          'ownerUid': uid,
          'memberUids': [uid],
          'joinCode': code,
          'scheduledAt': scheduledAt == null ? null : Timestamp.fromDate(scheduledAt),
          'rsvp': {uid: 'going'},
          'freeUids': <String>[],
          'planId': plan?.id,
          'planTitle': plan?.title,
          'planStops': plan?.stops.map((s) => s.toMap()).toList() ?? const [],
          'createdAt': FieldValue.serverTimestamp(),
          'lastMessageAt': FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (created) return groupRef.id;
    }
    throw Exception("Couldn't create the group. Please try again.");
  }

  /// Joins with an invite code. Returns the group id.
  Future<String> join(String uid, String rawCode) async {
    final code = rawCode.trim().toUpperCase();
    if (!RegExp(r'^[A-Z0-9]{4,10}$').hasMatch(code)) {
      throw Exception("That code doesn't look right.");
    }
    final codeDoc = await _codes.doc(code).get();
    final groupId = codeDoc.data()?['groupId'] as String?;
    if (groupId == null) {
      throw Exception('No group has that code. Check it and try again.');
    }
    try {
      await _groups.doc(groupId).update({
        'memberUids': FieldValue.arrayUnion([uid]),
      });
    } on FirebaseException catch (e) {
      // Already a member: the update changes nothing, which is fine.
      if (e.code == 'not-found') throw Exception('That group was deleted.');
      if (e.code != 'permission-denied') rethrow;
      final group = await _groups.doc(groupId).get();
      final members = (group.data()?['memberUids'] as List?) ?? const [];
      if (!members.contains(uid)) {
        throw Exception('This group is full, or the code is no longer valid.');
      }
    }
    return groupId;
  }

  Future<void> leave(String groupId, String uid) => _groups.doc(groupId).update({
        'memberUids': FieldValue.arrayRemove([uid]),
        'freeUids': FieldValue.arrayRemove([uid]),
        'rsvp.$uid': FieldValue.delete(),
      });

  /// Deletes the group, its messages and its invite code (organizer only).
  Future<void> delete(Group group) async {
    final messages = _groups.doc(group.id).collection('messages');
    while (true) {
      final page = await messages.limit(400).get();
      if (page.docs.isEmpty) break;
      final batch = _db.batch();
      for (final d in page.docs) {
        batch.delete(d.reference);
      }
      await batch.commit();
    }
    final batch = _db.batch()
      ..delete(_codes.doc(group.joinCode))
      ..delete(_groups.doc(group.id));
    await batch.commit();
  }

  /// Adds an accepted friend to the group.
  Future<void> addFriend(String groupId, String friendUid) =>
      _groups.doc(groupId).update({
        'memberUids': FieldValue.arrayUnion([friendUid]),
        'lastAddedUid': friendUid,
      });

  Future<void> setRsvp(String groupId, String uid, Rsvp rsvp) =>
      _groups.doc(groupId).update({'rsvp.$uid': rsvp.key});

  Future<void> setFree(String groupId, String uid, bool free) =>
      _groups.doc(groupId).update({
        'freeUids': free ? FieldValue.arrayUnion([uid]) : FieldValue.arrayRemove([uid]),
      });

  Future<void> setSchedule(String groupId, DateTime? when) =>
      _groups.doc(groupId).update({
        'scheduledAt': when == null ? null : Timestamp.fromDate(when),
      });

  Stream<List<GroupMessage>> watchMessages(String groupId) => _groups
      .doc(groupId)
      .collection('messages')
      .orderBy('createdAt', descending: true)
      .limit(200)
      .snapshots()
      .map((s) => s.docs.map((d) => GroupMessage.fromMap(d.id, d.data())).toList());

  Future<void> sendMessage({
    required String groupId,
    required String uid,
    required String name,
    required String text,
  }) async {
    final groupRef = _groups.doc(groupId);
    final preview = '$name: $text';
    final batch = _db.batch()
      ..set(groupRef.collection('messages').doc(), {
        'uid': uid,
        'name': name,
        'text': text,
        'createdAt': FieldValue.serverTimestamp(),
      })
      ..update(groupRef, {
        'lastMessage': preview.length > 100 ? '${preview.substring(0, 100)}…' : preview,
        'lastMessageAt': FieldValue.serverTimestamp(),
      });
    await batch.commit();
  }
}
