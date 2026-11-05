import 'package:flutter_test/flutter_test.dart';

import 'package:masar/app_state.dart';

void main() {
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
}
