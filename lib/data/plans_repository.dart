import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

import '../models/place.dart';
import '../models/plan.dart';
import '../planner/planner.dart';
import '../planner/services.dart';
import 'places_repository.dart';

class PlansRepository {
  PlansRepository(this._db, this._places);

  final FirebaseFirestore _db;
  final PlacesRepository _places;

  CollectionReference<Map<String, dynamic>> _plans(String uid) =>
      _db.collection('users').doc(uid).collection('plans');

  /// Builds a plan on the phone and saves it. Returns the new plan's id.
  ///
  /// By default the app's own planner does it: instant, works offline, and
  /// uses none of the free AI allowance. With [useAi], Gemini chooses from
  /// the same real places and writes the words; if it can't (offline, busy,
  /// allowance used up), the app's planner takes over.
  Future<String> generate(String uid, PlanRequest request, {bool useAi = false}) async {
    final day = request.day;
    final weatherFuture = fetchWeather(request.city, day: day);
    final places = await _places.all();
    final weather = await weatherFuture;

    final candidates = pickCandidates(places, request, weather, now: day);
    if (candidates.isEmpty) {
      throw Exception(request.mallId != null
          ? "We don't have venues listed inside this mall yet."
          : "We couldn't find places matching that. Try another vibe.");
    }

    ProposedPlan? plan;
    var source = 'local';
    if (useAi) {
      final prompt = buildPrompt(request, candidates, weather, DateFormat('EEEE', 'en').format(day));
      for (var attempt = 1; attempt <= 2 && plan == null; attempt++) {
        try {
          plan = validatePlan(await askGemini(prompt), candidates, request.stops);
        } on AiUnavailable catch (e) {
          debugPrint('$e');
          if (e.resting || e.reason == 'no key in this build') break;
        } catch (e) {
          debugPrint('AI attempt $attempt failed: $e');
        }
      }
      source = plan == null ? 'fallback' : 'ai';
    }
    plan ??= fallbackPlan(request, candidates);

    var stops = buildStops(plan.stops, candidates);
    final aiWrote = source == 'ai';
    if (!aiWrote) stops = withLocalReasons(stops, candidates, day);

    final outing = OutingPlan(
      id: '',
      title: aiWrote ? plan.title : localTitle(request, stops),
      summary: aiWrote ? plan.summary : localSummary(request, stops),
      tips: aiWrote ? plan.tips : const [],
      stops: stops,
      request: request,
      weatherNote: weatherNote(request.city, weather, day: day),
      source: source,
    );
    final doc = _plans(uid).doc();
    await doc.set({...outing.toMap(), 'createdAt': FieldValue.serverTimestamp()});
    return doc.id;
  }

  /// "Make it nicer with AI": Gemini writes a title, summary, tips and a
  /// sentence per stop for the plan's own real places. Places, order and
  /// times stay exactly the same. Throws [AiUnavailable] when it can't.
  Future<void> improveWithAi(String uid, OutingPlan plan) async {
    final all = await _places.all();
    final byId = {for (final p in all) p.id: p};
    final stopsPlaces = [for (final s in plan.stops) ?byId[s.placeId]];
    if (stopsPlaces.isEmpty) throw AiUnavailable('no places');
    final day = plan.request.day;
    final prompt = buildPrompt(
      PlanRequest.fromMap({...plan.request.toMap(), 'stops': stopsPlaces.length}),
      stopsPlaces,
      null,
      DateFormat('EEEE', 'en').format(day),
    );
    final words = validatePlan(await askGemini(prompt), stopsPlaces, stopsPlaces.length);
    if (words == null) throw AiUnavailable('answer not usable');
    final next = applyAiWords(plan, words);
    await _plans(uid).doc(plan.id).update({
      'title': next.title,
      'summary': next.summary,
      'tips': next.tips,
      'stops': next.stops.map((s) => s.toMap()).toList(),
      'source': 'ai',
    });
  }

  /// How many plans you've made (one cheap count, not a download of them all).
  Future<int> count(String uid) async => (await _plans(uid).count().get()).count ?? 0;

  Stream<OutingPlan?> watch(String uid, String planId) => _plans(uid)
      .doc(planId)
      .snapshots()
      .map((d) => d.exists ? OutingPlan.fromMap(d.id, d.data()!) : null);

  Future<OutingPlan?> get(String uid, String planId) async {
    final d = await _plans(uid).doc(planId).get();
    return d.exists ? OutingPlan.fromMap(d.id, d.data()!) : null;
  }

  Stream<List<OutingPlan>> watchSaved(String uid) => _plans(uid)
      .where('saved', isEqualTo: true)
      .snapshots()
      .map((s) => s.docs.map((d) => OutingPlan.fromMap(d.id, d.data())).toList()
        ..sort((a, b) => (b.createdAt ?? DateTime(0))
            .compareTo(a.createdAt ?? DateTime(0))));

  /// Similar real places that could replace stop [index].
  Future<List<Place>> alternatives(OutingPlan plan, int index) async =>
      alternativesFor(plan, index, await _places.all());

  Future<void> replaceStop(String uid, OutingPlan plan, int index, Place place) =>
      _plans(uid).doc(plan.id).update({
        'stops': swapStop(plan, index, place).map((s) => s.toMap()).toList(),
      });

  /// Your newest plans, [limit] at a time (more load when you scroll).
  Stream<List<OutingPlan>> watchRecent(String uid, {int limit = 20}) => _plans(uid)
      .orderBy('createdAt', descending: true)
      .limit(limit)
      .snapshots()
      .map((s) => s.docs.map((d) => OutingPlan.fromMap(d.id, d.data())).toList());

  Future<void> updateStops(String uid, String planId, List<PlanStop> stops) =>
      _plans(uid).doc(planId).update({'stops': stops.map((s) => s.toMap()).toList()});

  /// Every plan, once (for "Export my data").
  Future<List<OutingPlan>> getAll(String uid) async => (await _plans(uid)
          .orderBy('createdAt', descending: true)
          .limit(500)
          .get())
      .docs
      .map((d) => OutingPlan.fromMap(d.id, d.data()))
      .toList();

  Future<void> rename(String uid, String planId, String title) {
    final t = title.trim();
    return _plans(uid).doc(planId).update({'title': t.length > 80 ? t.substring(0, 80) : t});
  }

  Future<void> setSaved(String uid, String planId, bool saved) =>
      _plans(uid).doc(planId).update({'saved': saved});

  /// Saves a copy of a plan (e.g. to try changes but keep the original).
  /// Puts a just-deleted plan back (Undo). New plans must start unsaved
  /// (security rules), so "saved" is set again right after.
  Future<void> restore(String uid, OutingPlan plan) async {
    final doc = _plans(uid).doc(plan.id);
    await doc.set({...plan.toMap(), 'saved': false, 'createdAt': FieldValue.serverTimestamp()});
    if (plan.saved) await doc.update({'saved': true});
  }

  Future<String> duplicate(String uid, OutingPlan plan) async {
    final t = 'Copy of ${plan.title}';
    final doc = _plans(uid).doc();
    await doc.set({
      ...plan.toMap(),
      'title': t.length > 80 ? t.substring(0, 80) : t,
      'saved': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
    return doc.id;
  }

  Future<void> delete(String uid, String planId) =>
      _plans(uid).doc(planId).delete();

  /// Saves a plan a friend shared with you (stops rebuilt from our data).
  Future<String> saveShared(String uid, OutingPlan plan) async {
    final doc = _plans(uid).doc();
    await doc.set({...plan.toMap(), 'source': 'local', 'saved': false, 'createdAt': FieldValue.serverTimestamp()});
    return doc.id;
  }
}
