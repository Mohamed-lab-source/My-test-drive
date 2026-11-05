import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../questions.dart';
import '../theme.dart';
import 'practice_session.dart';

/// Practice hub: quick quiz, mistakes review and every subject. All free.
class PracticeTab extends StatelessWidget {
  const PracticeTab({super.key, required this.state});

  final AppState state;

  void _open(BuildContext context, List<int> indices, String title, {int? limit}) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => PracticeSession(state: state, indices: indices, title: title, limit: limit)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final ar = state.isArabic;

        // Questions grouped by subject, in catalog order.
        final groups = <String, List<int>>{};
        for (var i = 0; i < questionBank.length; i++) {
          groups.putIfAbsent(questionBank[i].subject, () => <int>[]).add(i);
        }
        final order = <String>[
          for (final s in subjectCatalog)
            if (groups.containsKey(s.key)) s.key,
        ];
        final mine = state.myQuestionGroups;
        final myIndices = <int>[
          for (final k in order)
            if (mine.contains(k)) ...groups[k]!,
        ];
        final quizPool = myIndices.isEmpty ? List<int>.generate(questionBank.length, (i) => i) : myIndices;
        final mistakes = state.mistakes.where((i) => i >= 0 && i < questionBank.length).toList();
        final totalAnswered = state.answered.values.fold<int>(0, (a, b) => a + b);
        final totalRight = state.correct.values.fold<int>(0, (a, b) => a + b);
        final accuracy = totalAnswered == 0 ? 0 : (totalRight * 100 / totalAnswered).round();

        return Scaffold(
          appBar: AppBar(title: Text(t('تدريب', 'Practice'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(color: AppColors.ink, borderRadius: BorderRadius.circular(20)),
                child: Row(
                  children: <Widget>[
                    Expanded(child: _stat('${questionBank.length}', t('سؤال متاح مجاناً', 'free questions'))),
                    Expanded(child: _stat('$totalAnswered', t('جاوبت', 'answered'))),
                    Expanded(child: _stat('$accuracy%', t('صح', 'correct'))),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              SizedBox(
                height: 56,
                child: FilledButton.icon(
                  onPressed: () => _open(context, quizPool, t('اختبار سريع', 'Quick quiz'), limit: 10),
                  icon: const Icon(Icons.bolt),
                  label: Text(
                    myIndices.isEmpty ? t('اختبار سريع · 10 أسئلة', 'Quick quiz · 10 questions') : t('اختبار سريع من موادك · 10 أسئلة', 'Quick quiz from your subjects · 10 questions'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: mistakes.isEmpty ? null : () => _open(context, mistakes, t('مراجعة أخطائي', 'My mistakes')),
                  icon: const Icon(Icons.replay),
                  label: Text(
                    mistakes.isEmpty ? t('مفيش أخطاء تراجعها', 'No mistakes to review') : t('راجع أخطائي (${mistakes.length})', 'Review my mistakes (${mistakes.length})'),
                    style: const TextStyle(fontSize: 15),
                  ),
                ),
              ),
              const SizedBox(height: 22),
              Text(t('اتدرب على مادة', 'Practise a subject'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Text(t('موادك متعلم عليها بالأزرق.', 'Your subjects are marked in blue.'),
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 10),
              for (final k in order)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _subjectCard(context, k, groups[k]!, mine.contains(k), ar),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _stat(String value, String label) {
    return Column(
      children: <Widget>[
        Text(value, style: const TextStyle(color: AppColors.white, fontSize: 24, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.white, fontSize: 12)),
      ],
    );
  }

  Widget _subjectCard(BuildContext context, String key, List<int> indices, bool isMine, bool ar) {
    final t = state.tr;
    final info = subjectInfo(key);
    final name = info == null ? key : (ar ? info.nameAr : info.nameEn);
    final done = state.answered[key] ?? 0;
    final right = state.correct[key] ?? 0;
    final pct = done == 0 ? null : (right * 100 / done).round();
    return Material(
      color: isMine ? AppColors.blueSoft : AppColors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _open(context, indices, name),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isMine ? AppColors.blue : AppColors.line),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink)),
                    const SizedBox(height: 3),
                    Text(
                      pct == null
                          ? t('${indices.length} سؤال', '${indices.length} questions')
                          : t('${indices.length} سؤال · صح $pct%', '${indices.length} questions · $pct% right'),
                      style: const TextStyle(fontSize: 12, color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.play_circle_outline, color: AppColors.blue),
            ],
          ),
        ),
      ),
    );
  }
}
