import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';
import 'dialogs.dart';

class SubjectScreen extends StatelessWidget {
  const SubjectScreen({super.key, required this.state, required this.subjectId});

  final AppState state;
  final String subjectId;

  Future<void> _addAttempt(BuildContext context, Subject s) async {
    final t = state.tr;
    final text = await askText(
      context,
      title: t('درجة المحاولة ${s.attempts.length + 1}', 'Attempt ${s.attempts.length + 1} score'),
      hint: t('من 0 لـ 100', 'From 0 to 100'),
      okLabel: t('حفظ', 'Save'),
      cancelLabel: t('إلغاء', 'Cancel'),
      numbersOnly: true,
    );
    if (text == null || !context.mounted) return;
    final score = int.tryParse(text);
    if (score == null || score < 0 || score > AppState.maxScore) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(t('اكتب رقم من 0 لـ 100', 'Enter a number from 0 to 100'))),
      );
      return;
    }
    state.addAttempt(s.id, score);
  }

  Future<void> _rename(BuildContext context, Subject s) async {
    final t = state.tr;
    final text = await askText(
      context,
      title: t('اسم المادة', 'Subject name'),
      hint: t('اسم المادة', 'Subject name'),
      okLabel: t('حفظ', 'Save'),
      cancelLabel: t('إلغاء', 'Cancel'),
      initial: state.subjectName(s),
    );
    if (text != null) state.renameSubject(s.id, text);
  }

  Future<void> _delete(BuildContext context, Subject s) async {
    final t = state.tr;
    final ok = await confirm(
      context,
      title: t('حذف المادة؟', 'Delete subject?'),
      message: t('هتتمسح المادة وكل درجاتها.', 'The subject and all its scores will be deleted.'),
      yesLabel: t('حذف', 'Delete'),
      noLabel: t('إلغاء', 'Cancel'),
    );
    if (!ok || !context.mounted) return;
    Navigator.of(context).pop();
    state.removeSubject(s.id);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final s = state.subjectById(subjectId);
        if (s == null) {
          return const Scaffold(body: SizedBox.shrink());
        }
        return Scaffold(
          appBar: AppBar(
            title: Text(state.subjectName(s), style: const TextStyle(fontWeight: FontWeight.w700)),
            actions: <Widget>[
              IconButton(
                tooltip: t('تعديل الاسم', 'Rename'),
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => _rename(context, s),
              ),
              IconButton(
                tooltip: t('حذف', 'Delete'),
                icon: const Icon(Icons.delete_outline),
                onPressed: () => _delete(context, s),
              ),
            ],
          ),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: AppColors.ink, borderRadius: BorderRadius.circular(22)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(t('أعلى درجة (دي اللي بتتحسب)', 'Best score (this is what counts)'),
                        style: const TextStyle(color: AppColors.white, fontSize: 13)),
                    const SizedBox(height: 8),
                    Text(
                      s.attempts.isEmpty ? '—' : '${s.best} / 100',
                      style: const TextStyle(color: AppColors.white, fontSize: 40, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      t('استخدمت ${s.attempts.length} من ${AppState.maxAttempts} محاولات',
                          'Used ${s.attempts.length} of ${AppState.maxAttempts} attempts'),
                      style: const TextStyle(color: AppColors.white, fontSize: 13),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(t('المحاولات', 'Attempts'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              if (s.attempts.isEmpty)
                Panel(
                  child: Text(
                    t('لسه ما سجلتش أي درجة للمادة دي.', 'No scores recorded for this subject yet.'),
                    style: const TextStyle(color: AppColors.muted),
                  ),
                ),
              for (var i = 0; i < s.attempts.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Panel(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    child: Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            i == 0 ? t('المحاولة 1 · مجانية', 'Attempt 1 · free') : t('المحاولة ${i + 1}', 'Attempt ${i + 1}'),
                            style: const TextStyle(fontSize: 15),
                          ),
                        ),
                        Text('${s.attempts[i]}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                        IconButton(
                          tooltip: t('مسح', 'Remove'),
                          icon: const Icon(Icons.close, size: 20),
                          onPressed: () => state.removeAttempt(s.id, i),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 12),
              SizedBox(
                height: 54,
                child: FilledButton.icon(
                  onPressed: s.canRetake ? () => _addAttempt(context, s) : null,
                  icon: const Icon(Icons.add),
                  label: Text(
                    s.canRetake ? t('سجل درجة محاولة', 'Add an attempt score') : t('خلصت كل المحاولات', 'All attempts used'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Panel(
                color: AppColors.blueSoft,
                child: Text(
                  t('أعلى درجة بس هي اللي بتتحسب · المحاولة الأولى مجانية · المحاولة الاختيارية بـ 200 جنيه للمادة',
                      'Only your best score counts · The first attempt is free · An optional attempt costs 200 EGP per subject'),
                  style: const TextStyle(color: AppColors.blueDark, fontSize: 13, height: 1.6),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
