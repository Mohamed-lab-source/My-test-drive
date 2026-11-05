import 'dart:math';

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../questions.dart';
import '../theme.dart';

/// Runs through a list of questions one by one, then shows the result.
class PracticeSession extends StatefulWidget {
  const PracticeSession({super.key, required this.state, required this.indices, required this.title, this.limit});

  final AppState state;

  /// Positions in questionBank.
  final List<int> indices;
  final String title;

  /// If set, only this many random questions are asked.
  final int? limit;

  @override
  State<PracticeSession> createState() => _PracticeSessionState();
}

class _PracticeSessionState extends State<PracticeSession> {
  late List<int> _order;
  int _pos = 0;
  int? _picked;
  int _right = 0;
  final List<int> _wrong = <int>[];

  @override
  void initState() {
    super.initState();
    _order = List<int>.of(widget.indices)..shuffle(Random());
    if (widget.limit != null && _order.length > widget.limit!) {
      _order = _order.sublist(0, widget.limit!);
    }
  }

  /// Same shuffled option order every time for a given question.
  List<int> _optionOrder(int questionIndex, int count) {
    final order = List<int>.generate(count, (i) => i);
    order.shuffle(Random(questionIndex * 31 + 7));
    return order;
  }

  void _pick(int optionIndex) {
    if (_picked != null) return;
    final qi = _order[_pos];
    final q = questionBank[qi];
    final isRight = optionIndex == q.correct;
    setState(() {
      _picked = optionIndex;
      if (isRight) {
        _right++;
      } else {
        _wrong.add(qi);
      }
    });
    widget.state.recordAnswer(qi, q.subject, isRight);
  }

  void _next() {
    setState(() {
      _pos++;
      _picked = null;
    });
  }

  void _restart() {
    setState(() {
      _order.shuffle(Random());
      _pos = 0;
      _picked = null;
      _right = 0;
      _wrong.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final t = state.tr;
    final ar = state.isArabic;

    if (_order.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Panel(child: Text(t('مفيش أسئلة هنا لسه.', 'No questions here yet.'))),
        ),
      );
    }

    if (_pos >= _order.length) {
      final total = _order.length;
      final percent = (_right * 100 / total).round();
      return Scaffold(
        appBar: AppBar(title: Text(widget.title)),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
          children: <Widget>[
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(24)),
              child: Column(
                children: <Widget>[
                  Text(t('نتيجتك', 'Your result'), style: const TextStyle(color: AppColors.white, fontSize: 14)),
                  const SizedBox(height: 8),
                  Text('$_right / $total', style: const TextStyle(color: AppColors.white, fontSize: 44, fontWeight: FontWeight.w700)),
                  Text('$percent%', style: const TextStyle(color: AppColors.white, fontSize: 18)),
                  const SizedBox(height: 8),
                  Text(
                    percent >= 85
                        ? t('ممتاز! كمّل كده.', 'Excellent! Keep it up.')
                        : percent >= 60
                            ? t('كويس. راجع أخطاءك وهتبقى أحسن.', 'Good. Review your mistakes and you will improve.')
                            : t('ولا يهمك. ذاكر الدرس وجرب تاني.', 'No worries. Study the lesson and try again.'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.white, fontSize: 14),
                  ),
                ],
              ),
            ),
            if (_wrong.isNotEmpty) ...<Widget>[
              const SizedBox(height: 18),
              Text(t('راجع دول', 'Review these'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (final qi in _wrong)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(ar ? questionBank[qi].qAr : questionBank[qi].qEn, style: const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text(
                          '${t('الإجابة', 'Answer')}: ${questionBank[qi].options(ar)[questionBank[qi].correct]}',
                          style: const TextStyle(color: AppColors.blueDark, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(ar ? questionBank[qi].exAr : questionBank[qi].exEn,
                            style: const TextStyle(fontSize: 13, height: 1.6, color: AppColors.muted)),
                      ],
                    ),
                  ),
                ),
            ],
            const SizedBox(height: 16),
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _restart,
                child: Text(t('جرب تاني', 'Try again'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 50,
              child: OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text(t('رجوع', 'Back'), style: const TextStyle(fontSize: 15)),
              ),
            ),
          ],
        ),
      );
    }

    final qi = _order[_pos];
    final q = questionBank[qi];
    final options = q.options(ar);
    final order = _optionOrder(qi, options.length);
    final answered = _picked != null;
    final isRight = answered && _picked == q.correct;
    final subj = subjectInfo(q.subject);

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(subj == null ? '' : (ar ? subj.nameAr : subj.nameEn),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.muted)),
              ),
              Text(t('${_pos + 1} من ${_order.length}', '${_pos + 1} of ${_order.length}'),
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: _pos / _order.length,
              minHeight: 6,
              backgroundColor: AppColors.line,
              color: AppColors.blue,
            ),
          ),
          const SizedBox(height: 20),
          Text(ar ? q.qAr : q.qEn, style: const TextStyle(fontSize: 22, height: 1.5, fontWeight: FontWeight.w700, color: AppColors.ink)),
          const SizedBox(height: 18),
          for (final oi in order)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _pick(oi),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(58),
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    backgroundColor: _bg(oi, q.correct),
                    foregroundColor: _fg(oi, q.correct),
                    side: BorderSide(color: _border(oi, q.correct)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text(options[oi], textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)),
                ),
              ),
            ),
          if (answered) ...<Widget>[
            const SizedBox(height: 4),
            Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    isRight ? t('برافو، صح!', 'Nice, that is right!') : t('مش مظبوط، شوف الشرح', 'Not quite. Here is why'),
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: isRight ? AppColors.blueDark : AppColors.amberInk),
                  ),
                  const SizedBox(height: 8),
                  Text(ar ? q.exAr : q.exEn, style: const TextStyle(fontSize: 14, height: 1.7, color: Color(0xFF3E475B))),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 54,
              child: FilledButton(
                onPressed: _next,
                child: Text(
                  _pos + 1 >= _order.length ? t('شوف النتيجة', 'See my result') : t('السؤال اللي بعده', 'Next question'),
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _bg(int i, int correct) {
    if (_picked == null) return AppColors.white;
    if (i == correct) return AppColors.blue;
    if (i == _picked) return AppColors.amberSoft;
    return AppColors.white;
  }

  Color _fg(int i, int correct) {
    if (_picked == null) return AppColors.ink;
    if (i == correct) return AppColors.white;
    if (i == _picked) return AppColors.amberInk;
    return AppColors.ink;
  }

  Color _border(int i, int correct) {
    if (_picked == null) return AppColors.line;
    if (i == correct) return AppColors.blue;
    if (i == _picked) return const Color(0xFFB4620A);
    return AppColors.line;
  }
}
