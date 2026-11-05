import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../theme.dart';

class PracticeTab extends StatefulWidget {
  const PracticeTab({super.key, required this.state});

  final AppState state;

  @override
  State<PracticeTab> createState() => _PracticeTabState();
}

class _PracticeTabState extends State<PracticeTab> {
  int _index = 0;
  int? _picked;
  int _correctCount = 0;
  int _answeredCount = 0;

  void _pick(int option) {
    if (_picked != null) return;
    setState(() {
      _picked = option;
      _answeredCount += 1;
      if (option == practiceQuestions[_index].correct) _correctCount += 1;
    });
  }

  void _next() {
    setState(() {
      _index = (_index + 1) % practiceQuestions.length;
      _picked = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final state = widget.state;
        final t = state.tr;
        final q = practiceQuestions[_index];
        final options = state.isArabic ? q.optionsAr : q.optionsEn;
        final answered = _picked != null;
        final isRight = answered && _picked == q.correct;

        return Scaffold(
          appBar: AppBar(title: Text(t('تدريب', 'Practice'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              Row(
                children: <Widget>[
                  _tag(state.isArabic ? q.subjectAr : q.subjectEn, bold: true),
                  const SizedBox(width: 8),
                  _tag(t('سؤال ${_index + 1} من ${practiceQuestions.length}', 'Question ${_index + 1} of ${practiceQuestions.length}')),
                  const Spacer(),
                  Text(t('صح $_correctCount من $_answeredCount', '$_correctCount / $_answeredCount right'),
                      style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ],
              ),
              const SizedBox(height: 18),
              Text(state.isArabic ? q.qAr : q.qEn,
                  style: const TextStyle(fontSize: 24, height: 1.45, fontWeight: FontWeight.w700, color: AppColors.ink)),
              const SizedBox(height: 18),
              for (var i = 0; i < options.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SizedBox(
                    width: double.infinity,
                    height: 60,
                    child: OutlinedButton(
                      onPressed: () => _pick(i),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: _optionBg(i, q.correct),
                        foregroundColor: _optionFg(i, q.correct),
                        side: BorderSide(color: _optionBorder(i, q.correct)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(options[i], style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                    ),
                  ),
                ),
              if (answered) ...<Widget>[
                const SizedBox(height: 6),
                Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        isRight ? t('برافو، صح!', "Nice, that's right!") : t('قربت، شوف الشرح', 'Close — here is why'),
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: isRight ? AppColors.blueDark : AppColors.amberInk,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(state.isArabic ? q.explainAr : q.explainEn,
                          style: const TextStyle(fontSize: 14, height: 1.7, color: Color(0xFF3E475B))),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 54,
                  child: FilledButton(
                    onPressed: _next,
                    child: Text(t('السؤال اللي بعده', 'Next question'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Panel(
                color: AppColors.ink,
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(t('مسار بلس', 'Masar Plus'),
                              style: const TextStyle(color: AppColors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(t('أسئلة المنهج كاملة وشرح بلا حدود · قريباً', 'Full curriculum questions & unlimited explanations · coming soon'),
                              style: const TextStyle(color: AppColors.white, fontSize: 12)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              Text(
                t('دي أسئلة تجريبية للنسخة الأولى.', 'These are sample questions for version 1.'),
                style: const TextStyle(fontSize: 12, color: AppColors.muted),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _tag(String text, {bool bold = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: AppColors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.line),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 12, fontWeight: bold ? FontWeight.w600 : FontWeight.w400, color: bold ? AppColors.ink : AppColors.muted),
      ),
    );
  }

  Color _optionBg(int i, int correct) {
    if (_picked == null) return AppColors.white;
    if (i == correct) return AppColors.blue;
    if (i == _picked) return AppColors.amberSoft;
    return AppColors.white;
  }

  Color _optionFg(int i, int correct) {
    if (_picked == null) return AppColors.ink;
    if (i == correct) return AppColors.white;
    if (i == _picked) return AppColors.amberInk;
    return AppColors.ink;
  }

  Color _optionBorder(int i, int correct) {
    if (_picked == null) return AppColors.line;
    if (i == correct) return AppColors.blue;
    if (i == _picked) return const Color(0xFFB4620A);
    return AppColors.line;
  }
}
