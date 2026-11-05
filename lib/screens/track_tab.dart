import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../theme.dart';

class TrackTab extends StatefulWidget {
  const TrackTab({super.key, required this.state, required this.onSaved});

  final AppState state;
  final VoidCallback onSaved;

  @override
  State<TrackTab> createState() => _TrackTabState();
}

class _TrackTabState extends State<TrackTab> {
  bool _quizRunning = false;
  int _step = 0;
  List<int> _tally = <int>[0, 0, 0, 0];

  void _start() {
    setState(() {
      _quizRunning = true;
      _step = 0;
      _tally = <int>[0, 0, 0, 0];
    });
  }

  void _answer(int option) {
    setState(() {
      _tally[option] += 1;
      _step += 1;
    });
    if (_step >= trackQuiz.length) {
      var best = 0;
      for (var i = 1; i < _tally.length; i++) {
        if (_tally[i] > _tally[best]) best = i;
      }
      widget.state.setTrack(best);
      setState(() => _quizRunning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final state = widget.state;
        final t = state.tr;
        Widget body;

        if (_quizRunning && _step < trackQuiz.length) {
          final q = trackQuiz[_step];
          final options = state.isArabic ? q.optionsAr : q.optionsEn;
          body = ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              Text(t('سؤال ${_step + 1} من ${trackQuiz.length}', 'Question ${_step + 1} of ${trackQuiz.length}'),
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(
                  value: _step / trackQuiz.length,
                  minHeight: 6,
                  backgroundColor: AppColors.line,
                  color: AppColors.blue,
                ),
              ),
              const SizedBox(height: 28),
              Text(state.isArabic ? q.qAr : q.qEn,
                  style: const TextStyle(fontSize: 26, height: 1.35, fontWeight: FontWeight.w700, color: AppColors.ink)),
              const SizedBox(height: 22),
              for (var i = 0; i < options.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => _answer(i),
                      style: OutlinedButton.styleFrom(
                        backgroundColor: AppColors.white,
                        foregroundColor: AppColors.ink,
                        alignment: AlignmentDirectional.centerStart,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        side: const BorderSide(color: AppColors.line),
                      ),
                      child: Text(options[i], style: const TextStyle(fontSize: 16)),
                    ),
                  ),
                ),
            ],
          );
        } else if (state.track != null) {
          final info = tracks[state.track!];
          body = ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              Text(t('المسار الأنسب ليك', 'Your best-fit track'), style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(24)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(state.isArabic ? info.nameAr : info.nameEn,
                        style: const TextStyle(color: AppColors.white, fontSize: 28, height: 1.25, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Text(t('كليات ممكن يوصلك ليها', 'Colleges it can lead to'),
                        style: const TextStyle(color: AppColors.white, fontSize: 14)),
                    const SizedBox(height: 4),
                    Text(state.isArabic ? info.collegesAr : info.collegesEn,
                        style: const TextStyle(color: AppColors.white, fontSize: 16, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Panel(
                child: Text(
                  t('ده ترشيح مش قرار. اتكلم مع أهلك ومدرسك، واتأكد من دليل الوزارة الرسمي.',
                      "This is a suggestion, not a decision. Talk it through with your family and teacher, and check the Ministry's official guide."),
                  style: const TextStyle(fontSize: 14, height: 1.6, color: AppColors.muted),
                ),
              ),
              const SizedBox(height: 14),
              Text(t('أو اختار مسارك بنفسك', 'Or choose your track yourself'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              for (var i = 0; i < tracks.length; i++)
                ListTile(
                  onTap: () => state.setTrack(i),
                  leading: Icon(
                    state.track == i ? Icons.check_circle : Icons.circle_outlined,
                    color: state.track == i ? AppColors.blue : AppColors.muted,
                  ),
                  title: Text(state.isArabic ? tracks[i].nameAr : tracks[i].nameEn),
                  contentPadding: EdgeInsets.zero,
                ),
              const SizedBox(height: 10),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: widget.onSaved,
                  child: Text(t('ابدأ خطة الدرجات', 'Start my score plan'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 50,
                child: OutlinedButton(
                  onPressed: _start,
                  child: Text(t('اعمل الاختبار تاني', 'Retake the quiz'), style: const TextStyle(fontSize: 15)),
                ),
              ),
            ],
          );
        } else {
          body = ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              const SizedBox(height: 20),
              const Icon(Icons.explore_outlined, size: 64, color: AppColors.blue),
              const SizedBox(height: 16),
              Text(t('مش عارف تختار مسارك؟', 'Not sure which track to choose?'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.ink)),
              const SizedBox(height: 10),
              Text(
                t('جاوب على 3 أسئلة سريعة ونقولك أنسب مسار ليك.', "Answer 3 quick questions and we'll suggest the track that fits you."),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 15, height: 1.6, color: AppColors.muted),
              ),
              const SizedBox(height: 28),
              SizedBox(
                height: 56,
                child: FilledButton(
                  onPressed: _start,
                  child: Text(t('ابدأ الاختبار', 'Start the quiz'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          );
        }

        return Scaffold(
          appBar: AppBar(title: Text(t('اختار مسارك', 'Find your track'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: body,
        );
      },
    );
  }
}
