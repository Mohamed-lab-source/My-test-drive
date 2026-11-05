import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../theme.dart';
import 'dialogs.dart';
import 'subject_screen.dart';

class HomeTab extends StatelessWidget {
  const HomeTab({super.key, required this.state, required this.onOpenPlan});

  final AppState state;
  final VoidCallback onOpenPlan;

  Future<void> _pickNextAttempt(BuildContext context) async {
    final t = state.tr;
    if (state.subjects.isEmpty) return;
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: state.nextDate != null && state.nextDate!.isAfter(now) ? state.nextDate! : now,
      firstDate: DateTime(now.year, now.month, now.day),
      lastDate: now.add(const Duration(days: 730)),
      helpText: t('ميعاد المحاولة الجاية', 'Next attempt date'),
    );
    if (date == null || !context.mounted) return;
    final subjectId = await showModalBottomSheet<String>(
      context: context,
      builder: (sheetContext) {
        return SafeArea(
          child: ListView(
            shrinkWrap: true,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                child: Text(t('أنهي مادة؟', 'Which subject?'), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
              ),
              for (final s in state.subjects)
                ListTile(
                  title: Text(state.subjectName(s)),
                  onTap: () => Navigator.of(sheetContext).pop(s.id),
                ),
            ],
          ),
        );
      },
    );
    if (subjectId == null) return;
    state.setNextAttempt(date, subjectId);
  }

  Widget _dots(int used) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        for (var i = 0; i < AppState.maxAttempts; i++)
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsetsDirectional.only(end: 5),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i < used ? AppColors.blue : null,
              border: i < used ? null : Border.all(color: const Color(0xFF9AA1B1)),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final total = state.total;
        final double progress = state.goal <= 0 ? 0 : (total / state.goal).clamp(0.0, 1.0).toDouble();
        final next = state.subjectById(state.nextSubjectId);
        final today = DateTime.now();
        final daysLeft = state.nextDate == null
            ? null
            : DateTime(state.nextDate!.year, state.nextDate!.month, state.nextDate!.day)
                .difference(DateTime(today.year, today.month, today.day))
                .inDays;
        final trackName = state.track == null
            ? t('لسه ما اخترتش مسار', 'No track chosen yet')
            : (state.isArabic ? tracks[state.track!].nameAr : tracks[state.track!].nameEn);

        return Scaffold(
          appBar: AppBar(
            title: Row(
              children: <Widget>[
                const MasarLogo(),
                const SizedBox(width: 10),
                Text(t('مسار', 'Masar'), style: const TextStyle(fontWeight: FontWeight.w700)),
              ],
            ),
            actions: <Widget>[
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 12),
                child: OutlinedButton(
                  onPressed: state.toggleLanguage,
                  child: Text(state.isArabic ? 'English' : 'عربي'),
                ),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
            children: <Widget>[
              Text(t('أهلاً بيك', 'Welcome back'), style: const TextStyle(fontSize: 14, color: AppColors.muted)),
              Text(
                state.name.isEmpty ? t('يا بطل', 'Champ') : state.name,
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.ink),
              ),
              const SizedBox(height: 16),

              // Total score card
              InkWell(
                onTap: onOpenPlan,
                borderRadius: BorderRadius.circular(22),
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(22)),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(t('مجموعك بأعلى درجاتك', 'Your total using your best scores'),
                          style: const TextStyle(color: AppColors.white, fontSize: 13)),
                      const SizedBox(height: 8),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: <Widget>[
                          Text('$total', style: const TextStyle(color: AppColors.white, fontSize: 44, fontWeight: FontWeight.w700, height: 1)),
                          const SizedBox(width: 8),
                          Text(t('من ${state.maxTotal}', 'of ${state.maxTotal}'),
                              style: const TextStyle(color: AppColors.white, fontSize: 15)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: progress,
                          minHeight: 8,
                          backgroundColor: AppColors.whiteFaded,
                          color: AppColors.amber,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        t('هدفك ${state.goal} · $trackName', 'Goal ${state.goal} · $trackName'),
                        style: const TextStyle(color: AppColors.white, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),

              // Next attempt card
              InkWell(
                onTap: () => _pickNextAttempt(context),
                borderRadius: BorderRadius.circular(18),
                child: Panel(
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(t('المحاولة الجاية', 'Next attempt'), style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                            const SizedBox(height: 3),
                            Text(
                              next == null || state.nextDate == null
                                  ? t('اضغط وحدد الميعاد', 'Tap to set the date')
                                  : '${state.subjectName(next)} · ${formatDate(state.nextDate!)}',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                      ),
                      if (daysLeft != null && daysLeft >= 0)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(12)),
                          child: Text(
                            daysLeft == 0 ? t('النهارده', 'Today') : t('$daysLeft يوم', '$daysLeft days'),
                            style: const TextStyle(color: AppColors.amberInk, fontSize: 14, fontWeight: FontWeight.w700),
                          ),
                        )
                      else
                        const Icon(Icons.event_outlined, color: AppColors.muted),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Subjects
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(t('موادك', 'Your subjects'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  ),
                  TextButton.icon(
                    onPressed: () async {
                      final name = await askText(
                        context,
                        title: t('مادة جديدة', 'New subject'),
                        hint: t('اسم المادة', 'Subject name'),
                        okLabel: t('إضافة', 'Add'),
                        cancelLabel: t('إلغاء', 'Cancel'),
                      );
                      if (name != null) state.addSubject(name);
                    },
                    icon: const Icon(Icons.add),
                    label: Text(t('إضافة', 'Add')),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              if (state.subjects.isEmpty)
                Panel(
                  child: Text(
                    t('ضيف موادك عشان نحسب مجموعك.', 'Add your subjects so we can count your total.'),
                    style: const TextStyle(color: AppColors.muted),
                  ),
                ),
              for (final s in state.subjects)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => SubjectScreen(state: state, subjectId: s.id)),
                    ),
                    child: Panel(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      child: Row(
                        children: <Widget>[
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(state.subjectName(s), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                                const SizedBox(height: 6),
                                Row(
                                  children: <Widget>[
                                    _dots(s.attempts.length),
                                    Text(
                                      t('${s.attempts.length} من ${AppState.maxAttempts} محاولات',
                                          '${s.attempts.length} of ${AppState.maxAttempts} attempts'),
                                      style: const TextStyle(fontSize: 11, color: AppColors.muted),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          Text(
                            s.attempts.isEmpty ? '—' : '${s.best}',
                            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                          ),
                          const Text('/100', style: TextStyle(fontSize: 12, color: AppColors.muted)),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
