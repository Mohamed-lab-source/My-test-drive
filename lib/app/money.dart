import 'dart:math' as math;

import '../planner/planner.dart' show haversineKm;

/// Group money and "where we start" — the pure parts (tested in
/// test/money_test.dart). Prices are only what people type from the menu or
/// the receipt; Khroga never guesses a price.

/// One thing someone ordered (`groups/{id}/orders/{orderId}`).
class OrderItem {
  const OrderItem({
    required this.id,
    required this.uid,
    required this.name,
    required this.item,
    required this.price,
    this.qty = 1,
    this.shared = false,
    this.place,
  });

  final String id;
  final String uid;
  final String name;
  final String item;

  /// Price of one, in Egyptian pounds, as typed by the person.
  final double price;
  final int qty;

  /// For the whole table (split between everyone in the group).
  final bool shared;

  /// Which stop it was from (a real place name from the plan), if picked.
  final String? place;

  double get total => price * qty;

  static OrderItem? fromMap(String id, Map<String, dynamic> d) {
    final price = d['price'], qty = d['qty'];
    if (price is! num || d['uid'] is! String || d['item'] is! String) return null;
    return OrderItem(
      id: id,
      uid: d['uid'] as String,
      name: d['name'] as String? ?? '',
      item: d['item'] as String,
      price: price.toDouble(),
      qty: qty is int ? qty : 1,
      shared: d['shared'] == true,
      place: d['place'] as String?,
    );
  }
}

/// What each person owes in total: their own items, an equal part of the
/// shared ones (between [members]), plus [extraPct] % (service, tax).
Map<String, double> sharesFor(List<OrderItem> items, List<String> members, double extraPct) {
  final out = {for (final m in members) m: 0.0};
  final sharedTotal = items.where((i) => i.shared).fold(0.0, (a, i) => a + i.total);
  for (final i in items.where((i) => !i.shared)) {
    out[i.uid] = (out[i.uid] ?? 0) + i.total;
  }
  if (members.isNotEmpty && sharedTotal > 0) {
    for (final m in members) {
      out[m] = out[m]! + sharedTotal / members.length;
    }
  }
  return {for (final e in out.entries) e.key: e.value * (1 + extraPct / 100)};
}

/// The whole bill (all items plus extras).
double billTotal(List<OrderItem> items, double extraPct) =>
    items.fold(0.0, (a, i) => a + i.total) * (1 + extraPct / 100);

/// What to send, rounded up to whole pounds so the collector never ends up
/// short.
int amountToSend(double share) => share <= 0 ? 0 : (share - 0.000001).ceil();

/// An InstaPay payment link (made in the InstaPay app: your name → share
/// payment link). Only real ipn.eg links are accepted, so a fake page can't
/// be passed off as InstaPay.
bool isInstapayLink(String s) => RegExp(r'^https://ipn\.eg/S/[A-Za-z0-9._~/-]{1,120}$').hasMatch(s.trim());

/// An InstaPay address (name@instapay) or an Egyptian mobile number.
bool isInstapayAddress(String s) =>
    RegExp(r'^(01[0125][0-9]{8}|[A-Za-z0-9._-]{1,40}@instapay)$').hasMatch(s.trim());

// ---------------------------------------------------------------------------
// Where we start: a fair middle for the group.

/// A starting point is saved rounded to about 1 km, so nobody shares their
/// exact home.
(double, double) roundForPrivacy(double lat, double lng) =>
    ((lat * 100).roundToDouble() / 100, (lng * 100).roundToDouble() / 100);

/// The point with the least total travel for everyone (geometric median).
/// Unlike a plain average, one person far away doesn't drag the meeting
/// point away from everybody else.
(double, double)? fairCenter(List<(double, double)> points) {
  if (points.isEmpty) return null;
  var lat = points.map((p) => p.$1).reduce((a, b) => a + b) / points.length;
  var lng = points.map((p) => p.$2).reduce((a, b) => a + b) / points.length;
  for (var step = 0; step < 100; step++) {
    var wSum = 0.0, latSum = 0.0, lngSum = 0.0;
    var onPoint = false;
    for (final p in points) {
      final d = haversineKm(lat, lng, p.$1, p.$2);
      if (d < 1e-6) {
        onPoint = true;
        continue;
      }
      wSum += 1 / d;
      latSum += p.$1 / d;
      lngSum += p.$2 / d;
    }
    if (wSum == 0) break;
    final nLat = latSum / wSum, nLng = lngSum / wSum;
    if (onPoint && haversineKm(lat, lng, nLat, nLng) < 1e-4) break;
    final moved = haversineKm(lat, lng, nLat, nLng);
    lat = nLat;
    lng = nLng;
    if (moved < 0.001) break;
  }
  return (lat, lng);
}

/// How far the farthest person is from [center], in km.
double farthestKm((double, double) center, List<(double, double)> points) =>
    points.fold(0.0, (m, p) => math.max(m, haversineKm(center.$1, center.$2, p.$1, p.$2)));
