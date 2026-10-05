import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/place.dart';

/// "I'm here" at a real place. One document per person (the latest), seen
/// by the friends listed in `visibleTo`. Removed whenever you like.
class CheckIn {
  const CheckIn({
    required this.uid,
    required this.name,
    required this.placeId,
    required this.placeName,
    this.area,
    this.lat,
    this.lng,
    this.createdAt,
  });

  final String uid;
  final String name;
  final String placeId;
  final String placeName;
  final String? area;
  final double? lat;
  final double? lng;
  final DateTime? createdAt;

  /// Check-ins are shown for 24 hours.
  bool isFresh(DateTime now) =>
      createdAt != null && now.difference(createdAt!) < const Duration(hours: 24);

  factory CheckIn.fromMap(String uid, Map<String, dynamic> m) => CheckIn(
        uid: uid,
        name: (m['name'] as String?) ?? '',
        placeId: (m['placeId'] as String?) ?? '',
        placeName: (m['placeName'] as String?) ?? '',
        area: m['area'] as String?,
        lat: (m['lat'] as num?)?.toDouble(),
        lng: (m['lng'] as num?)?.toDouble(),
        createdAt: (m['createdAt'] as Timestamp?)?.toDate(),
      );
}

class CheckInsRepository {
  CheckInsRepository(this._db);

  final FirebaseFirestore _db;
  CollectionReference<Map<String, dynamic>> get _col => _db.collection('checkins');

  Future<void> checkIn({
    required String uid,
    required String name,
    required Place place,
    required List<String> friendUids,
  }) =>
      _col.doc(uid).set({
        'name': name.length > 60 ? name.substring(0, 60) : name,
        'placeId': place.id,
        'placeName': place.name.length > 120 ? place.name.substring(0, 120) : place.name,
        'area': place.area,
        'lat': place.lat,
        'lng': place.lng,
        'visibleTo': friendUids.take(500).toList(),
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> remove(String uid) => _col.doc(uid).delete();

  Stream<CheckIn?> watchMine(String uid) =>
      _col.doc(uid).snapshots().map((d) => d.exists ? CheckIn.fromMap(d.id, d.data()!) : null);

  /// Check-ins your friends shared with you.
  Stream<List<CheckIn>> watchShared(String uid) => _col
      .where('visibleTo', arrayContains: uid)
      .snapshots()
      .map((s) => s.docs.map((d) => CheckIn.fromMap(d.id, d.data())).toList());
}
