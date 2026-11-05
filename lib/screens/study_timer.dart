import 'dart:async';

import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';

/// Focus timer: study for a set time, then take a short break.
class StudyTimerScreen extends StatefulWidget {
  const StudyTimerScreen({super.key, required this.state});

  final AppState state;

  @override
  State<StudyTimerScreen> createState() => _StudyTimerScreenState();
}

class _StudyTimerScreenState extends State<StudyTimerScreen> {
  static const List<int> _choices = <int>[25, 45, 60];
  static const int _breakMinutes = 5;

  int _focusMinutes = 25;
  bool _onBreak = false;
  bool _running = false;
  DateTime? _endsAt;
  Duration _left = const Duration(minutes: 25);
  int _countedMinutes = 0;
  Timer? _ticker;

  @override
  void dispose() {
    _ticker?.cancel();
    if (!_onBreak) {
      final add = (_phaseLength - _left).inMinutes - _countedMinutes;
      final state = widget.state;
      // Saved after the screen closes, so the app does not rebuild mid-close.
      if (add > 0) Future<void>.microtask(() => state.addStudyMinutes(add));
    }
    super.dispose();
  }

  Duration get _phaseLength => Duration(minutes: _onBreak ? _breakMinutes : _focusMinutes);

  void _start() {
    _endsAt = DateTime.now().add(_left);
    _ticker?.cancel();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    setState(() => _running = true);
  }

  void _pause() {
    _ticker?.cancel();
    _saveFocusProgress();
    setState(() => _running = false);
  }

  void _reset() {
    _ticker?.cancel();
    _saveFocusProgress();
    setState(() {
      _running = false;
      _onBreak = false;
      _countedMinutes = 0;
      _left = Duration(minutes: _focusMinutes);
    });
  }

  /// Adds whole focus minutes done so far to today's study time.
  void _saveFocusProgress() {
    if (_onBreak) return;
    final doneMinutes = (_phaseLength - _left).inMinutes;
    final add = doneMinutes - _countedMinutes;
    if (add > 0) {
      _countedMinutes += add;
      widget.state.addStudyMinutes(add);
    }
  }

  void _tick() {
    final end = _endsAt;
    if (end == null) return;
    final left = end.difference(DateTime.now());
    if (left > Duration.zero) {
      setState(() => _left = left);
      return;
    }
    // Phase finished.
    _ticker?.cancel();
    if (!_onBreak) {
      _left = Duration.zero;
      _saveFocusProgress();
    }
    setState(() {
      _running = false;
      _onBreak = !_onBreak;
      _countedMinutes = 0;
      _left = _phaseLength;
    });
    if (mounted) {
      final t = widget.state.tr;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(_onBreak
              ? t('برافو! خد راحة $_breakMinutes دقايق.', 'Well done! Take a $_breakMinutes-minute break.')
              : t('الراحة خلصت. يلا نكمل!', 'Break is over. Let us continue!')),
        ),
      );
    }
  }

  String _format(Duration d) {
    final m = d.inMinutes.toString().padLeft(2, '0');
    final s = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.state,
      builder: (context, _) {
        final state = widget.state;
        final t = state.tr;
        final progress = _phaseLength.inSeconds == 0 ? 0.0 : 1 - (_left.inSeconds / _phaseLength.inSeconds);
        return Scaffold(
          appBar: AppBar(title: Text(t('مؤقت المذاكرة', 'Study timer'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(child: _statCard(t('النهارده', 'Today'), t('${state.todayMinutes} دقيقة', '${state.todayMinutes} min'))),
                  const SizedBox(width: 10),
                  Expanded(child: _statCard(t('أيام ورا بعض', 'Day streak'), '${state.streak}')),
                  const SizedBox(width: 10),
                  Expanded(child: _statCard(t('الإجمالي', 'Total'), t('${(state.totalStudyMinutes / 60).toStringAsFixed(1)} ساعة', '${(state.totalStudyMinutes / 60).toStringAsFixed(1)} h'))),
                ],
              ),
              const SizedBox(height: 28),
              Center(
                child: SizedBox(
                  width: 240,
                  height: 240,
                  child: Stack(
                    alignment: Alignment.center,
                    children: <Widget>[
                      SizedBox(
                        width: 240,
                        height: 240,
                        child: CircularProgressIndicator(
                          value: progress.clamp(0.0, 1.0).toDouble(),
                          strokeWidth: 12,
                          backgroundColor: AppColors.line,
                          color: _onBreak ? AppColors.amber : AppColors.blue,
                        ),
                      ),
                      Column(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Text(_format(_left), style: const TextStyle(fontSize: 52, fontWeight: FontWeight.w700, color: AppColors.ink)),
                          Text(_onBreak ? t('راحة', 'Break') : t('تركيز', 'Focus'),
                              style: const TextStyle(fontSize: 16, color: AppColors.muted)),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 28),
              if (!_running && !_onBreak)
                Row(
                  children: <Widget>[
                    for (var i = 0; i < _choices.length; i++) ...<Widget>[
                      if (i > 0) const SizedBox(width: 8),
                      Expanded(
                        child: SizedBox(
                          height: 46,
                          child: _choices[i] == _focusMinutes
                              ? FilledButton(
                                  onPressed: () {},
                                  child: Text(t('${_choices[i]} د', '${_choices[i]} min')),
                                )
                              : OutlinedButton(
                                  onPressed: () => setState(() {
                                    _focusMinutes = _choices[i];
                                    _countedMinutes = 0;
                                    _left = Duration(minutes: _focusMinutes);
                                  }),
                                  child: Text(t('${_choices[i]} د', '${_choices[i]} min')),
                                ),
                        ),
                      ),
                    ],
                  ],
                ),
              const SizedBox(height: 16),
              SizedBox(
                height: 56,
                child: FilledButton.icon(
                  onPressed: _running ? _pause : _start,
                  icon: Icon(_running ? Icons.pause : Icons.play_arrow_rounded),
                  label: Text(_running ? t('إيقاف مؤقت', 'Pause') : t('ابدأ', 'Start'),
                      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                height: 50,
                child: OutlinedButton(
                  onPressed: _reset,
                  child: Text(t('ابدأ من الأول', 'Reset'), style: const TextStyle(fontSize: 15)),
                ),
              ),
              const SizedBox(height: 18),
              Panel(
                color: AppColors.blueSoft,
                child: Text(
                  t('خلي الموبايل مفتوح على الشاشة دي وانت بتذاكر. وقت التركيز بيتحسب في يومك تلقائياً.',
                      'Keep this screen open while you study. Focus time is added to your day automatically.'),
                  style: const TextStyle(color: AppColors.blueDark, fontSize: 13, height: 1.6),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _statCard(String label, String value) {
    return Panel(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
      child: Column(
        children: <Widget>[
          Text(value, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.ink)),
          const SizedBox(height: 4),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
        ],
      ),
    );
  }
}
