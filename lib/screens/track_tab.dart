import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../theme.dart';
import 'guide_tab.dart';
import 'track_setup.dart';

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
  int? _suggested;

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
      if (_step >= trackQuiz.length) {
        var best = 0;
        for (var i = 1; i < _tally.length; i++) {
          if (_tally[i] > _tally[best]) best = i;
        }
        _suggested = best;
        _quizRunning = false;
      }
    });
  }

  Future<void> _setup(int trackIndex) async {
    final ok = await showTrackSetup(context, widget.state, trackIndex);
    if (ok) widget.onSaved();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final state = widget.state;
        final t = state.tr;
        final ar = state.isArabic;
        Widget body;

        if (_quizRunning && _step < trackQuiz.length) {
          final q = trackQuiz[_step];
          final options = ar ? q.optionsAr : q.optionsEn;
          body = ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              Text(t('سؤال ${_step + 1} من ${trackQuiz.length}', 'Question ${_step + 1} of ${trackQuiz.length}'),
                  style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(3),
                child: LinearProgressIndicator(value: _step / trackQuiz.length, minHeight: 6, backgroundColor: AppColors.line, color: AppColors.blue),
              ),
              const SizedBox(height: 28),
              Text(ar ? q.qAr : q.qEn, style: const TextStyle(fontSize: 26, height: 1.35, fontWeight: FontWeight.w700, color: AppColors.ink)),
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
        } else {
          final shown = _suggested ?? state.track;
          body = ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              if (shown != null) ...<Widget>[
                Text(
                  _suggested != null ? t('المسار الأنسب ليك حسب إجاباتك', 'Best-fit track from your answers') : t('مسارك الحالي', 'Your current track'),
                  style: const TextStyle(fontSize: 13, color: AppColors.muted),
                ),
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(22),
                  decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(24)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(ar ? tracks[shown].nameAr : tracks[shown].nameEn,
                          style: const TextStyle(color: AppColors.white, fontSize: 28, height: 1.25, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      Text(ar ? tracks[shown].fieldsAr : tracks[shown].fieldsEn,
                          style: const TextStyle(color: AppColors.white, fontSize: 15, height: 1.5)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: FilledButton(
                          onPressed: () => _setup(shown),
                          child: Text(state.track == shown ? t('غيّر الاختيارية', 'Change elective') : t('اختار المسار ده', 'Choose this track')),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: SizedBox(
                        height: 52,
                        child: OutlinedButton(
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(builder: (_) => TrackGuideScreen(state: state, trackIndex: shown)),
                          ),
                          child: Text(t('تفاصيل المسار', 'Track details')),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Panel(
                  child: Text(
                    t('ده ترشيح مش قرار. اتكلم مع أهلك ومدرسك، واتأكد من دليل الوزارة.',
                        'This is a suggestion, not a decision. Talk it through with your family and teacher, and check the Ministry guide.'),
                    style: const TextStyle(fontSize: 13, height: 1.6, color: AppColors.muted),
                  ),
                ),
                const SizedBox(height: 22),
              ] else ...<Widget>[
                const SizedBox(height: 12),
                const Icon(Icons.explore_outlined, size: 64, color: AppColors.blue),
                const SizedBox(height: 14),
                Text(t('مش عارف تختار مسارك؟', 'Not sure which track to choose?'),
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.ink)),
                const SizedBox(height: 8),
                Text(t('جاوب على ${trackQuiz.length} أسئلة سريعة ونرشحلك أنسب مسار.', 'Answer ${trackQuiz.length} quick questions and we will suggest a track.'),
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 15, height: 1.6, color: AppColors.muted)),
                const SizedBox(height: 20),
              ],
              SizedBox(
                height: 54,
                child: shown == null
                    ? FilledButton(
                        onPressed: _start,
                        child: Text(t('ابدأ الاختبار', 'Start the quiz'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                      )
                    : OutlinedButton(
                        onPressed: _start,
                        child: Text(t('اعمل الاختبار تاني', 'Take the quiz again'), style: const TextStyle(fontSize: 15)),
                      ),
              ),
              const SizedBox(height: 22),
              Text(t('أو اختار مسارك بنفسك', 'Or choose your track yourself'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              for (var i = 0; i < tracks.length; i++)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(state.track == i ? Icons.check_circle : Icons.circle_outlined, color: state.track == i ? AppColors.blue : AppColors.muted),
                  title: Text(ar ? tracks[i].nameAr : tracks[i].nameEn),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => _setup(i),
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
