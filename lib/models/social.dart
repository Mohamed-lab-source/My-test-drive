import 'package:cloud_firestore/cloud_firestore.dart';

/// The public part of a user, visible to other signed-in users.
class PublicProfile {
  const PublicProfile({
    required this.uid,
    required this.displayName,
    this.username,
    this.photoUrl,
  });

  final String uid;
  final String displayName;
  final String? username;
  final String? photoUrl;

  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory PublicProfile.fromMap(String uid, Map<String, dynamic> m) =>
      PublicProfile(
        uid: uid,
        displayName: (m['displayName'] as String?) ?? 'Khroga user',
        username: m['username'] as String?,
        photoUrl: m['photoUrl'] as String?,
      );
}

enum FriendshipStatus { pending, accepted }

/// A friendship between exactly two users, stored once for the pair.
class Friendship {
  const Friendship({
    required this.id,
    required this.uids,
    required this.requestedBy,
    required this.status,
  });

  final String id;
  final List<String> uids;
  final String requestedBy;
  final FriendshipStatus status;

  String otherUid(String me) => uids.firstWhere((u) => u != me, orElse: () => me);

  /// Same id no matter who sends the request, so duplicates are impossible.
  static String idFor(String a, String b) {
    final sorted = [a, b]..sort();
    return '${sorted[0]}_${sorted[1]}';
  }

  factory Friendship.fromMap(String id, Map<String, dynamic> m) => Friendship(
        id: id,
        uids: ((m['uids'] as List?) ?? const []).whereType<String>().toList(),
        requestedBy: (m['requestedBy'] as String?) ?? '',
        status: m['status'] == 'accepted'
            ? FriendshipStatus.accepted
            : FriendshipStatus.pending,
      );
}

enum Rsvp { going, maybe, notGoing }

extension RsvpX on Rsvp {
  String get key => switch (this) {
        Rsvp.going => 'going',
        Rsvp.maybe => 'maybe',
        Rsvp.notGoing => 'no',
      };
  String get label => switch (this) {
        Rsvp.going => 'Going',
        Rsvp.maybe => 'Maybe',
        Rsvp.notGoing => "Can't",
      };
  static Rsvp? parse(Object? v) => switch (v) {
        'going' => Rsvp.going,
        'maybe' => Rsvp.maybe,
        'no' => Rsvp.notGoing,
        _ => null,
      };
}

class Group {
  const Group({
    required this.id,
    required this.name,
    required this.ownerUid,
    required this.memberUids,
    required this.joinCode,
    this.scheduledAt,
    this.planId,
    this.planTitle,
    this.planStops = const [],
    this.rsvp = const {},
    this.freeUids = const [],
    this.lastMessage,
    this.lastMessageAt,
  });

  final String id;
  final String name;
  final String ownerUid;
  final List<String> memberUids;
  final String joinCode;
  final DateTime? scheduledAt;
  final String? planId;
  final String? planTitle;

  /// Snapshot of the plan's stops so every member can see them.
  final List<Map<String, dynamic>> planStops;
  final Map<String, Rsvp> rsvp;

  /// Members who don't pay (e.g. it's their birthday). Owner decides.
  final List<String> freeUids;
  final String? lastMessage;
  final DateTime? lastMessageAt;

  bool isOwner(String uid) => uid == ownerUid;

  List<String> get payingUids {
    final going = memberUids.where((u) => rsvp[u] == Rsvp.going).toList();
    return going.where((u) => !freeUids.contains(u)).toList();
  }

  factory Group.fromMap(String id, Map<String, dynamic> m) {
    final rawRsvp = Map<String, dynamic>.from((m['rsvp'] as Map?) ?? const {});
    return Group(
      id: id,
      name: (m['name'] as String?) ?? 'Group',
      ownerUid: (m['ownerUid'] as String?) ?? '',
      memberUids:
          ((m['memberUids'] as List?) ?? const []).whereType<String>().toList(),
      joinCode: (m['joinCode'] as String?) ?? '',
      scheduledAt: (m['scheduledAt'] as Timestamp?)?.toDate(),
      planId: m['planId'] as String?,
      planTitle: m['planTitle'] as String?,
      planStops: ((m['planStops'] as List?) ?? const [])
          .whereType<Map>()
          .map((s) => Map<String, dynamic>.from(s))
          .toList(),
      rsvp: {
        for (final e in rawRsvp.entries)
          if (RsvpX.parse(e.value) != null) e.key: RsvpX.parse(e.value)!,
      },
      freeUids:
          ((m['freeUids'] as List?) ?? const []).whereType<String>().toList(),
      lastMessage: m['lastMessage'] as String?,
      lastMessageAt: (m['lastMessageAt'] as Timestamp?)?.toDate(),
    );
  }
}

class GroupMessage {
  const GroupMessage({
    required this.id,
    required this.uid,
    required this.name,
    required this.text,
    this.createdAt,
  });

  final String id;
  final String uid;
  final String name;
  final String text;
  final DateTime? createdAt;

  factory GroupMessage.fromMap(String id, Map<String, dynamic> m) =>
      GroupMessage(
        id: id,
        uid: (m['uid'] as String?) ?? '',
        name: (m['name'] as String?) ?? '',
        text: (m['text'] as String?) ?? '',
        createdAt: (m['createdAt'] as Timestamp?)?.toDate(),
      );
}
