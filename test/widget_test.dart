import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:masar/app_state.dart';
import 'package:masar/content.dart';
import 'package:masar/questions.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  test('best attempt counts and plan reaches the goal', () {
    final state = AppState();
    state.subjects = <Subject>[
      Subject(id: 'a', nameAr: 'أ', nameEn: 'A', attempts: <int>[60, 70]),
      Subject(id: 'b', nameAr: 'ب', nameEn: 'B', attempts: <int>[90]),
    ];
    state.goal = 180;
    expect(state.total, 160);
    final result = state.plan();
    expect(result.reachable, true);
    expect(result.steps.first.subject.id, 'a');
    expect(result.steps.first.to, 90);
  });

  test('every track builds six subjects out of 600', () {
    for (var t = 0; t < tracks.length; t++) {
      for (var e = 0; e < tracks[t].electives.length; e++) {
        final state = AppState();
        state.subjects = <Subject>[];
        state.applyTrack(t, e);
        expect(state.subjects.length, 6);
        expect(state.maxTotal, 600);
        expect(state.subjects.where((s) => s.year == 3).length, 2);
      }
    }
  });

  test('question bank is valid', () {
    for (final q in questionBank) {
      expect(q.correct >= 0 && q.correct < q.optsAr.length, true, reason: q.qEn);
      if (q.optsEn != null) expect(q.optsEn!.length, q.optsAr.length, reason: q.qEn);
      expect(subjectInfo(q.subject) != null, true, reason: q.subject);
    }
    for (final s in subjectCatalog) {
      expect(s.tipsAr.length, s.tipsEn.length, reason: s.key);
    }
  });
}
