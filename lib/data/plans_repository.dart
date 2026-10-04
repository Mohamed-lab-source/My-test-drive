import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';

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
  /// The AI only chooses from real places we hand it. If it fails (no
  /// internet, busy, free quota used up), we build the plan ourselves.
  Future<String> generate(String uid, PlanRequest request) async {
    final weatherFuture = fetchWeather(request.city);
    final places = await _places.all();
    final weather = await weatherFuture;

    final candidates = pickCandidates(places, request, weather);
    if (candidates.isEmpty) {
      throw Exception(request.mallId != null
          ? "We don't have venues listed inside this mall yet."
          : "We couldn't find places matching that. Try another vibe.");
    }

    final weekday = DateFormat('EEEE').format(DateTime.now());
    final prompt = buildPrompt(request, candidates, weather, weekday);

    ProposedPlan? plan;
    var source = 'ai';
    for (var attempt = 1; attempt <= 2 && plan == null; attempt++) {
      try {
        plan = validatePlan(await askGemini(prompt), candidates, request.stops);
      } on AiUnavailable catch (e) {
        debugPrint('$e');
        if (e.reason == 'no key in this build') break;
      } catch (e) {
        debugPrint('AI attempt $attempt failed: $e');
      }
    }
    if (plan == null) {
      source = 'fallback';
      plan = fallbackPlan(request, candidates);
    }

    final outing = OutingPlan(
      id: '',
      title: plan.title,
      summary: plan.summary,
      tips: plan.tips,
      stops: buildStops(plan.stops, candidates),
      request: request,
      weatherNote: weatherNote(request.city, weather),
      source: source,
    );
    final doc = _plans(uid).doc();
    await doc.set({...outing.toMap(), 'createdAt': FieldValue.serverTimestamp()});
    return doc.id;
  }

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

  Future<void> setSaved(String uid, String planId, bool saved) =>
      _plans(uid).doc(planId).update({'saved': saved});

  Future<void> delete(String uid, String planId) =>
      _plans(uid).doc(planId).delete();
}
