import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/live.dart';
import '../app/theme_settings.dart' show sharedPrefsProvider;
import '../planner/planner.dart' show haversineKm;
import 'live_repository.dart';
import 'providers.dart';

final liveRepositoryProvider = Provider((ref) => LiveRepository(ref.watch(firestoreProvider)));

/// Everyone sharing their live location in a group right now.
final groupLiveProvider = StreamProvider.autoDispose.family<List<LiveSpot>, String>(
    (ref, groupId) => ref.watch(liveRepositoryProvider).watch(groupId));

/// What you're sharing: which group, until when, and your status.
class LiveShare {
  const LiveShare({this.groupId, this.until, this.status, this.me});

  final String? groupId;
  final DateTime? until;
  final String? status;
  final (double, double)? me;

  bool get on => groupId != null;
}

/// Shares your location with one group while Khroga is open, for the time
/// you picked. Positions are only sent when worth it ([shouldSendLive]), and
/// your spot is deleted when you stop or the time is up.
class LiveShareController extends Notifier<LiveShare> {
  StreamSubscription<(double, double)>? _sub;
  Timer? _timer;
  (double, double)? _lastSent;
  DateTime? _lastAt;
  (double, double)? _meet;

  @override
  LiveShare build() {
    ref.onDispose(_cancel);
    return const LiveShare();
  }

  void _cancel() {
    _sub?.cancel();
    _timer?.cancel();
    _sub = null;
    _timer = null;
  }

  /// Starts sharing with [groupId] for [minutes]. [meet] is the meeting
  /// point, so "I'm here" is set by itself when you get close.
  Future<void> start(String groupId, int minutes, {(double, double)? meet}) async {
    final location = ref.read(locationServiceProvider);
    await location.ensureAllowed();
    if (state.on && state.groupId != groupId) await stop();
    _cancel();
    _meet = meet;
    _lastSent = null;
    _lastAt = null;
    state = LiveShare(groupId: groupId, until: DateTime.now().add(Duration(minutes: minutes)), status: 'way');
    final first = await location.current();
    await _onPosition(first);
    _sub = location.moving().listen(_onPosition, onError: (_) {});
    _timer = Timer.periodic(const Duration(minutes: 1), (_) async {
      final until = state.until;
      if (until == null || DateTime.now().isAfter(until)) {
        await stop();
      } else if (state.me != null) {
        await _onPosition(state.me!); // keep the spot fresh while standing still
      }
    });
  }

  Future<void> _onPosition((double, double) p) async {
    if (!state.on) return;
    var status = state.status;
    if (_meet case final m? when hasArrived(haversineKm(p.$1, p.$2, m.$1, m.$2))) status = 'here';
    state = LiveShare(groupId: state.groupId, until: state.until, status: status, me: p);
    final now = DateTime.now();
    if (!shouldSendLive(lastPoint: _lastSent, lastAt: _lastAt, point: p, now: now)) return;
    await _send(p, now);
  }

  Future<void> _send((double, double) p, DateTime now) async {
    final uid = ref.read(uidProvider);
    final groupId = state.groupId;
    final until = state.until;
    if (uid == null || groupId == null || until == null) return;
    _lastSent = p;
    _lastAt = now;
    try {
      await ref.read(liveRepositoryProvider).share(
            groupId: groupId,
            uid: uid,
            name: ref.read(myProfileProvider).value?.displayName ?? 'Friend',
            lat: p.$1,
            lng: p.$2,
            until: until,
            status: state.status,
          );
    } catch (_) {
      // Offline for a moment: the next position tries again.
      _lastAt = null;
    }
  }

  /// "On my way" ('way'), "I'm here" ('here') or nothing.
  Future<void> setStatus(String? status) async {
    if (!state.on) return;
    state = LiveShare(groupId: state.groupId, until: state.until, status: status, me: state.me);
    if (state.me != null) await _send(state.me!, DateTime.now());
  }

  Future<void> stop() async {
    _cancel();
    final uid = ref.read(uidProvider);
    final groupId = state.groupId;
    state = const LiveShare();
    if (uid != null && groupId != null) {
      await ref.read(liveRepositoryProvider).stop(groupId, uid).catchError((_) {});
    }
  }
}

final liveShareProvider = NotifierProvider<LiveShareController, LiveShare>(LiveShareController.new);

// ---------------------------------------------------------------------------
// Track my outing: your route, saved only on this phone.

/// A finished outing route.
class SavedTrack {
  const SavedTrack({required this.started, required this.points, this.title});

  final DateTime started;
  final List<TrackPoint> points;
  final String? title;

  double get km => trailKm(points);
  Duration get duration => points.isEmpty ? Duration.zero : points.last.at.difference(started);

  Map<String, dynamic> toJson() => {
        'started': started.millisecondsSinceEpoch,
        if (title != null) 'title': title,
        'pts': [
          for (final p in points)
            [double.parse(p.lat.toStringAsFixed(5)), double.parse(p.lng.toStringAsFixed(5)), p.at.millisecondsSinceEpoch],
        ],
      };

  static SavedTrack? fromJson(Object? j) {
    if (j is! Map) return null;
    final started = j['started'], pts = j['pts'];
    if (started is! int || pts is! List) return null;
    return SavedTrack(
      started: DateTime.fromMillisecondsSinceEpoch(started),
      title: j['title'] as String?,
      points: [
        for (final p in pts)
          if (p is List && p.length == 3 && p[0] is num && p[1] is num && p[2] is int)
            (lat: (p[0] as num).toDouble(), lng: (p[1] as num).toDouble(), at: DateTime.fromMillisecondsSinceEpoch(p[2])),
      ],
    );
  }
}

class TrackState {
  const TrackState({this.started, this.points = const []});

  final DateTime? started;
  final List<TrackPoint> points;

  bool get running => started != null;
}

/// Records your route while Khroga is open. Nothing is sent anywhere.
class TrackController extends Notifier<TrackState> {
  static const _key = 'tracks';
  StreamSubscription<(double, double)>? _sub;

  @override
  TrackState build() {
    ref.onDispose(() => _sub?.cancel());
    return const TrackState();
  }

  Future<void> start() async {
    final location = ref.read(locationServiceProvider);
    await location.ensureAllowed();
    await _sub?.cancel();
    final now = DateTime.now();
    state = TrackState(started: now);
    final first = await location.current();
    _add(first);
    _sub = location.moving(everyMeters: 10).listen(_add, onError: (_) {});
  }

  void _add((double, double) p) {
    if (!state.running) return;
    state = TrackState(
      started: state.started,
      points: addTrackPoint(state.points, (lat: p.$1, lng: p.$2, at: DateTime.now())),
    );
  }

  /// Stops and saves the route on the phone (the newest 20 are kept).
  Future<SavedTrack?> stop({String? title}) async {
    await _sub?.cancel();
    _sub = null;
    final started = state.started;
    final points = state.points;
    state = const TrackState();
    if (started == null || points.length < 2) return null;
    final track = SavedTrack(started: started, points: thinTrail(points), title: title);
    final prefs = ref.read(sharedPrefsProvider);
    final saved = [track, ...savedTracks(prefs?.getString(_key))].take(20).toList();
    await prefs?.setString(_key, jsonEncode([for (final t in saved) t.toJson()]));
    ref.invalidate(savedTracksProvider);
    return track;
  }

  Future<void> delete(DateTime started) async {
    final prefs = ref.read(sharedPrefsProvider);
    final left = savedTracks(prefs?.getString(_key)).where((t) => t.started != started).toList();
    await prefs?.setString(_key, jsonEncode([for (final t in left) t.toJson()]));
    ref.invalidate(savedTracksProvider);
  }
}

/// Reads saved routes; anything unreadable is skipped.
List<SavedTrack> savedTracks(String? raw) {
  if (raw == null) return const [];
  try {
    final list = jsonDecode(raw);
    return [
      if (list is List)
        for (final j in list) ?SavedTrack.fromJson(j),
    ];
  } catch (_) {
    return const [];
  }
}

final trackProvider = NotifierProvider<TrackController, TrackState>(TrackController.new);

final savedTracksProvider =
    Provider<List<SavedTrack>>((ref) => savedTracks(ref.watch(sharedPrefsProvider)?.getString('tracks')));
