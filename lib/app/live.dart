import 'dart:math' as math;

import '../models/place.dart';
import 'i18n.dart';
import '../planner/planner.dart' show haversineKm;

/// Live location in a group and "Track my outing": the pure parts (tested
/// in test/live_test.dart). Locations only come from the phone's GPS, and
/// times/distances are labeled as rough wherever they are shown.

/// One member's live spot in a group (`groups/{id}/live/{uid}`).
class LiveSpot {
  const LiveSpot({
    required this.uid,
    required this.name,
    required this.lat,
    required this.lng,
    required this.updatedAt,
    required this.until,
    this.status,
  });

  final String uid;
  final String name;
  final double lat;
  final double lng;
  final DateTime updatedAt;

  /// Sharing stops by itself at this time.
  final DateTime until;

  /// 'way' (on my way), 'here' (arrived) or null.
  final String? status;

  /// Still sharing, and heard from in the last 15 minutes.
  bool isLive(DateTime now) => until.isAfter(now) && now.difference(updatedAt) < const Duration(minutes: 15);

  static LiveSpot? fromMap(String uid, Map<String, dynamic> d) {
    final lat = d['lat'], lng = d['lng'];
    final updated = d['updatedAt'], until = d['until'];
    if (lat is! num || lng is! num) return null;
    DateTime? time(Object? v) => v is DateTime ? v : (v as dynamic)?.toDate() as DateTime?;
    final u = time(updated), t = time(until);
    if (u == null || t == null) return null;
    return LiveSpot(
      uid: uid,
      name: d['name'] as String? ?? '',
      lat: lat.toDouble(),
      lng: lng.toDouble(),
      updatedAt: u,
      until: t,
      status: d['status'] as String?,
    );
  }
}

/// How long people can share for (minutes), the longest being 4 hours (the
/// security rules allow no more).
const liveDurations = [15, 60, 120, 240];

/// Whether a new position is worth sending: the first one, or after moving
/// 40 m (at most every 20 s), or every 2 minutes anyway so friends see
/// you're still there. Keeps the free database limits safe.
bool shouldSendLive({
  required (double, double)? lastPoint,
  required DateTime? lastAt,
  required (double, double) point,
  required DateTime now,
}) {
  if (lastPoint == null || lastAt == null) return true;
  final since = now.difference(lastAt);
  if (since >= const Duration(minutes: 2)) return true;
  if (since < const Duration(seconds: 20)) return false;
  return haversineKm(lastPoint.$1, lastPoint.$2, point.$1, point.$2) >= 0.04;
}

/// A rough time to cover [km]: walking (4.8 km/h) up to 1.5 km, else by car
/// (straight line × 1.4 at 22 km/h city speed, plus 3 minutes to get going).
int roughEtaMinutes(double km) {
  if (km <= 1.5) return math.max(1, (km / 4.8 * 60).round());
  return (km * 1.4 / 22 * 60).round() + 3;
}

/// Close enough to the meeting point to count as "arrived" (150 m).
bool hasArrived(double km) => km <= 0.15;

/// The middle of everyone's spots (fine at city scale).
(double, double)? fairMidpoint(List<(double, double)> points) {
  if (points.isEmpty) return null;
  final lat = points.map((p) => p.$1).reduce((a, b) => a + b) / points.length;
  final lng = points.map((p) => p.$2).reduce((a, b) => a + b) / points.length;
  return (lat, lng);
}

const _meetKinds = {'cafe', 'restaurant', 'mall', 'park', 'entertainment', 'cinema', 'activity'};

/// Real places to meet near [mid]: good kinds of places within [radiusKm],
/// the best-documented first (a ranking signal, never shown as a rating),
/// then the closest.
List<Place> meetingSpots(List<Place> places, (double, double) mid,
    {String? city, double radiusKm = 1.5, int limit = 8}) {
  final near = [
    for (final p in places)
      if (p.hasLocation &&
          _meetKinds.contains(p.category) &&
          (city == null || p.city == city) &&
          haversineKm(mid.$1, mid.$2, p.lat!, p.lng!) <= radiusKm)
        (p, haversineKm(mid.$1, mid.$2, p.lat!, p.lng!)),
  ]..sort((a, b) {
      final q = b.$1.quality.compareTo(a.$1.quality);
      return q != 0 ? q : a.$2.compareTo(b.$2);
    });
  return [for (final (p, _) in near.take(limit)) p];
}

// ---------------------------------------------------------------------------
// Track my outing (saved only on the phone).

/// One recorded point of an outing.
typedef TrackPoint = ({double lat, double lng, DateTime at});

/// Total distance along the points, in km.
double trailKm(List<TrackPoint> points) {
  var km = 0.0;
  for (var i = 1; i < points.length; i++) {
    km += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return km;
}

/// Adds [p] unless it's within [minMeters] of the last point (GPS jitter),
/// or an impossible jump (faster than 150 km/h since the last point).
List<TrackPoint> addTrackPoint(List<TrackPoint> points, TrackPoint p, {double minMeters = 15}) {
  if (points.isEmpty) return [p];
  final last = points.last;
  final km = haversineKm(last.lat, last.lng, p.lat, p.lng);
  if (km * 1000 < minMeters) return points;
  final hours = p.at.difference(last.at).inMilliseconds / 3600000;
  if (hours > 0 && km / hours > 150) return points;
  return [...points, p];
}

/// Fewer points for saving: keeps the first, the last, and one every
/// [everyMeters] in between.
List<TrackPoint> thinTrail(List<TrackPoint> points, {double everyMeters = 50}) {
  if (points.length <= 2) return points;
  final out = [points.first];
  for (final p in points.skip(1).take(points.length - 2)) {
    final last = out.last;
    if (haversineKm(last.lat, last.lng, p.lat, p.lng) * 1000 >= everyMeters) out.add(p);
  }
  return [...out, points.last];
}

/// "1 h 05 min" style duration.
String trackDuration(Duration d) {
  final h = d.inHours, m = d.inMinutes % 60;
  return h > 0
      ? trf('{h} h {m} min', {'h': h, 'm': m.toString().padLeft(2, '0')})
      : trf('{m} min', {'m': m});
}

/// Average moving speed in km/h (null if too short to say).
double? averageKmh(List<TrackPoint> points) {
  if (points.length < 2) return null;
  final hours = points.last.at.difference(points.first.at).inMilliseconds / 3600000;
  if (hours < 1 / 60) return null;
  return trailKm(points) / hours;
}
