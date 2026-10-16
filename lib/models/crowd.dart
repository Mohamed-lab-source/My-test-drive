import 'package:cloud_firestore/cloud_firestore.dart';

import '../app/i18n.dart';

/// "How busy is it right now?", told by Khroga users who are there.
/// Kept in `crowd/{placeId}` as counts only (no names). A new window starts
/// when the last one is 2 hours old; the security rules check every change.
/// Tested in test/crowd_test.dart.
const crowdLevels = <String, String>{'quiet': '😌 Quiet', 'normal': '🙂 Normal', 'busy': '😅 Busy'};

/// How long one window of reports lasts, and how often one person can
/// report the same place.
const crowdWindow = Duration(hours: 2);
const crowdGap = Duration(minutes: 30);

class CrowdNow {
  const CrowdNow({this.quiet = 0, this.normal = 0, this.busy = 0, this.since, this.last});

  final int quiet;
  final int normal;
  final int busy;

  /// When this window of reports started, and the newest report.
  final DateTime? since;
  final DateTime? last;

  int get total => quiet + normal + busy;

  int count(String level) => switch (level) {
    'quiet' => quiet,
    'normal' => normal,
    'busy' => busy,
    _ => 0,
  };

  factory CrowdNow.fromMap(Map<String, dynamic>? m) => CrowdNow(
    quiet: (m?['quiet'] as num?)?.toInt() ?? 0,
    normal: (m?['normal'] as num?)?.toInt() ?? 0,
    busy: (m?['busy'] as num?)?.toInt() ?? 0,
    since: (m?['since'] as Timestamp?)?.toDate(),
    last: (m?['last'] as Timestamp?)?.toDate(),
  );

  /// Reports from the last 2 hours exist.
  bool isRecent(DateTime now) => total > 0 && since != null && now.difference(since!) < crowdWindow;

  /// The most reported level (ties go to the busier one, to be safe).
  String? get top {
    if (total == 0) return null;
    var best = 'quiet';
    for (final l in ['normal', 'busy']) {
      if (count(l) >= count(best)) best = l;
    }
    return best;
  }
}

/// Whether a new report continues the current window. Uses a small margin
/// so the phone's clock and the server agree (the app retries the other way
/// if the server disagrees).
bool crowdContinues(CrowdNow? current, DateTime now) =>
    current != null &&
    current.since != null &&
    current.total > 0 &&
    now.difference(current.since!) < crowdWindow - const Duration(minutes: 3);

/// The counts after one report of [level].
Map<String, int> crowdCountsAfter(CrowdNow? current, String level, {required bool continues}) => {
  for (final l in crowdLevels.keys) l: (continues ? current?.count(l) ?? 0 : 0) + (l == level ? 1 : 0),
};

/// "Busy · 4 people said so in the last 2 hours" style text.
String crowdSummary(CrowdNow c) {
  final top = c.top;
  if (top == null) return '';
  return trf('{level} · {n} of {total} said so', {'level': tr(crowdLevels[top]!), 'n': c.count(top), 'total': c.total});
}

/// Minutes until you can report this place again, or 0.
int crowdMinutesLeft(DateTime? lastMine, DateTime now) {
  if (lastMine == null) return 0;
  final left = crowdGap - now.difference(lastMine);
  return left.isNegative ? 0 : left.inMinutes + 1;
}
