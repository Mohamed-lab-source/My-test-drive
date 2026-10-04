import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/plan.dart';

class PlansRepository {
  PlansRepository(this._db, this._functions);

  final FirebaseFirestore _db;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> _plans(String uid) =>
      _db.collection('users').doc(uid).collection('plans');

  /// Asks the server to build a plan. Returns the new plan's id.
  Future<String> generate(PlanRequest request) async {
    final result = await _functions
        .httpsCallable(
          'generatePlan',
          options: HttpsCallableOptions(timeout: const Duration(seconds: 90)),
        )
        .call<Map<String, dynamic>>(request.toMap());
    return result.data['planId'] as String;
  }

  Stream<OutingPlan?> watch(String uid, String planId) => _plans(uid)
      .doc(planId)
      .snapshots()
      .map((d) => d.exists ? OutingPlan.fromMap(d.id, d.data()!) : null);

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
