import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/social.dart';

class GroupsRepository {
  GroupsRepository(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _groups =>
      _db.collection('groups');

  Future<Map<String, dynamic>> _call(String name, Map<String, dynamic> data) async {
    final result =
        await _functions.httpsCallable(name).call<Map<String, dynamic>>(data);
    return result.data;
  }

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

  /// Groups are created by the server so join codes are always unique.
  Future<String> create({
    required String name,
    String? planId,
    DateTime? scheduledAt,
  }) async {
    final data = await _call('createGroup', {
      'name': name,
      'planId': planId,
      'scheduledAt': scheduledAt?.toUtc().toIso8601String(),
    });
    return data['groupId'] as String;
  }

  Future<String> join(String code) async {
    final data = await _call('joinGroup', {'code': code.trim().toUpperCase()});
    return data['groupId'] as String;
  }

  Future<void> leave(String groupId) => _call('leaveGroup', {'groupId': groupId});

  Future<void> delete(String groupId) =>
      _call('deleteGroup', {'groupId': groupId});

  Future<void> addFriend(String groupId, String friendUid) =>
      _call('addFriendToGroup', {'groupId': groupId, 'friendUid': friendUid});

  Future<void> setRsvp(String groupId, String uid, Rsvp rsvp) =>
      _groups.doc(groupId).update({'rsvp.$uid': rsvp.key});

  Future<void> setFree(String groupId, String uid, bool free) =>
      _groups.doc(groupId).update({
        'freeUids':
            free ? FieldValue.arrayUnion([uid]) : FieldValue.arrayRemove([uid]),
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
      .map((s) =>
          s.docs.map((d) => GroupMessage.fromMap(d.id, d.data())).toList());

  Future<void> sendMessage({
    required String groupId,
    required String uid,
    required String name,
    required String text,
  }) async {
    final ref = _groups.doc(groupId).collection('messages').doc();
    await ref.set({
      'uid': uid,
      'name': name,
      'text': text,
      'createdAt': FieldValue.serverTimestamp(),
    });
    // Push notifications are best-effort: a failure must never block chat.
    _call('notifyGroupMessage', {'groupId': groupId, 'messageId': ref.id})
        .ignore();
  }
}
