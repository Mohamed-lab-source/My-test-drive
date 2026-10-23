import 'package:cloud_firestore/cloud_firestore.dart';

import '../app/money.dart';

/// Who collects the money for an outing (`groups/{id}/money/settings`).
class MoneySettings {
  const MoneySettings({this.collectorUid, this.collectorName, this.payLink, this.payTo, this.extraPct = 0});

  final String? collectorUid;
  final String? collectorName;

  /// An InstaPay payment link (https://ipn.eg/S/…).
  final String? payLink;

  /// An InstaPay address (name@instapay) or mobile number.
  final String? payTo;

  /// Service/tax on top, in %.
  final double extraPct;

  static MoneySettings fromMap(Map<String, dynamic>? d) => d == null
      ? const MoneySettings()
      : MoneySettings(
          collectorUid: d['collectorUid'] as String?,
          collectorName: d['collectorName'] as String?,
          payLink: d['payLink'] as String?,
          payTo: d['payTo'] as String?,
          extraPct: (d['extraPct'] as num?)?.toDouble() ?? 0,
        );
}

/// A starting point (rounded to about 1 km): `groups/{id}/origins/{uid}`.
class Origin {
  const Origin({required this.uid, required this.lat, required this.lng, required this.label});

  final String uid;
  final double lat;
  final double lng;
  final String label;
}

/// Orders, the collector, who has paid, and where people start from. All of
/// it is checked by firestore.rules (own items only, real InstaPay links).
class MoneyRepository {
  MoneyRepository(this._db);

  final FirebaseFirestore _db;

  DocumentReference<Map<String, dynamic>> _group(String id) => _db.collection('groups').doc(id);
  DocumentReference<Map<String, dynamic>> _settings(String id) => _group(id).collection('money').doc('settings');

  Stream<MoneySettings> watchSettings(String groupId) =>
      _settings(groupId).snapshots().map((s) => MoneySettings.fromMap(s.data()));

  Stream<List<OrderItem>> watchOrders(String groupId) =>
      _group(groupId).collection('orders').orderBy('createdAt').limit(200).snapshots().map((s) => [
            for (final d in s.docs) ?OrderItem.fromMap(d.id, d.data()),
          ]);

  /// uid → amount they said they sent.
  Stream<Map<String, double>> watchPaid(String groupId) => _group(groupId).collection('paid').limit(60).snapshots().map(
        (s) => {for (final d in s.docs) d.id: (d.data()['amount'] as num?)?.toDouble() ?? 0},
      );

  Stream<List<Origin>> watchOrigins(String groupId) => _group(groupId).collection('origins').limit(60).snapshots().map(
        (s) => [
          for (final d in s.docs)
            if (d.data()['lat'] is num && d.data()['lng'] is num)
              Origin(
                uid: d.id,
                lat: (d.data()['lat'] as num).toDouble(),
                lng: (d.data()['lng'] as num).toDouble(),
                label: d.data()['label'] as String? ?? '',
              ),
        ],
      );

  Future<void> becomeCollector(String groupId, String uid, String name,
          {String? payLink, String? payTo, double extraPct = 0}) =>
      _settings(groupId).set({
        'collectorUid': uid,
        'collectorName': name.length > 40 ? name.substring(0, 40) : name,
        'payLink': payLink,
        'payTo': payTo,
        'extraPct': extraPct,
        'updatedAt': FieldValue.serverTimestamp(),
      });

  Future<void> clearCollector(String groupId, double extraPct) => _settings(groupId).set({
        'collectorUid': null,
        'collectorName': null,
        'payLink': null,
        'payTo': null,
        'extraPct': extraPct,
        'updatedAt': FieldValue.serverTimestamp(),
      });

  Future<void> setExtra(String groupId, MoneySettings s, double extraPct) => _settings(groupId).set({
        'collectorUid': s.collectorUid,
        'collectorName': s.collectorName,
        'payLink': s.payLink,
        'payTo': s.payTo,
        'extraPct': extraPct,
        'updatedAt': FieldValue.serverTimestamp(),
      });

  Future<void> addOrder(String groupId,
          {required String uid,
          required String name,
          required String item,
          required double price,
          int qty = 1,
          bool shared = false,
          String? place}) =>
      _group(groupId).collection('orders').add({
        'uid': uid,
        'name': name.length > 40 ? name.substring(0, 40) : name,
        'item': item,
        'price': price,
        'qty': qty,
        'shared': shared,
        'place': place,
        'createdAt': FieldValue.serverTimestamp(),
      });

  Future<void> deleteOrder(String groupId, String orderId) => _group(groupId).collection('orders').doc(orderId).delete();

  Future<void> setPaid(String groupId, String uid, double? amount) => amount == null
      ? _group(groupId).collection('paid').doc(uid).delete()
      : _group(groupId).collection('paid').doc(uid).set({'amount': amount, 'at': FieldValue.serverTimestamp()});

  /// Saves where you start from, rounded to about 1 km.
  Future<void> setOrigin(String groupId, String uid, double lat, double lng, String label) {
    final (rLat, rLng) = roundForPrivacy(lat, lng);
    return _group(groupId).collection('origins').doc(uid).set({
      'lat': rLat,
      'lng': rLng,
      'label': label.length > 60 ? label.substring(0, 60) : label,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  Future<void> clearOrigin(String groupId, String uid) => _group(groupId).collection('origins').doc(uid).delete();

  /// Your own orders in a group (for "Delete my account").
  Future<void> deleteMyOrders(String groupId, String uid) async {
    final mine = await _group(groupId).collection('orders').where('uid', isEqualTo: uid).limit(200).get();
    for (final d in mine.docs) {
      await d.reference.delete();
    }
  }
}
