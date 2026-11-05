import 'package:flutter/material.dart';

import '../app_state.dart';
import '../theme.dart';

class PlannerTab extends StatelessWidget {
  const PlannerTab({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final maxTotal = state.maxTotal;
        final total = state.total;
        final goal = state.goal > maxTotal ? maxTotal : state.goal;
        final gap = goal - total;
        final result = state.plan();
        final chips = <double>[0.85, 0.9, 0.95].map((f) => ((maxTotal * f) / 5).round() * 5).toSet().toList();

        return Scaffold(
          appBar: AppBar(title: Text(t('خطة الدرجات', 'Score planner'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: maxTotal == 0
              ? Padding(
                  padding: const EdgeInsets.all(20),
                  child: Panel(
                    child: Text(
                      t('ضيف موادك من الصفحة الرئيسية الأول.', 'Add your subjects from the Home tab first.'),
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
                  children: <Widget>[
                    Text(t('هدفك (من $maxTotal)', 'Your goal (out of $maxTotal)'),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 10),
                    Row(
                      children: <Widget>[
                        for (var i = 0; i < chips.length; i++) ...<Widget>[
                          if (i > 0) const SizedBox(width: 8),
                          Expanded(
                            child: SizedBox(
                              height: 48,
                              child: chips[i] == goal
                                  ? FilledButton(
                                      onPressed: () => state.setGoal(chips[i]),
                                      child: Text('${chips[i]}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                                    )
                                  : OutlinedButton(
                                      onPressed: () => state.setGoal(chips[i]),
                                      child: Text('${chips[i]}', style: const TextStyle(fontSize: 16)),
                                    ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    Slider(
                      value: goal.toDouble(),
                      min: 0,
                      max: maxTotal.toDouble(),
                      divisions: maxTotal ~/ 5 > 0 ? maxTotal ~/ 5 : null,
                      label: '$goal',
                      onChanged: (v) => state.setGoal(v.round()),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(color: AppColors.ink, borderRadius: BorderRadius.circular(20)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(t('مجموعك الحالي بأعلى درجاتك', 'Your total using your best scores'),
                              style: const TextStyle(color: AppColors.white, fontSize: 13)),
                          const SizedBox(height: 6),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: <Widget>[
                              Text('$total', style: const TextStyle(color: AppColors.white, fontSize: 36, fontWeight: FontWeight.w700, height: 1)),
                              const SizedBox(width: 10),
                              Text(
                                gap > 0 ? t('ناقصك $gap درجة', '$gap points to go') : t('وصلت لهدفك!', 'You reached your goal!'),
                                style: const TextStyle(color: AppColors.white, fontSize: 14),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (gap > 0) ...<Widget>[
                      const SizedBox(height: 20),
                      Text(t('أسهل طريق لهدفك', 'Easiest way to your goal'),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      for (final step in result.steps)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: Panel(
                            padding: const EdgeInsets.all(14),
                            child: Row(
                              children: <Widget>[
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(state.subjectName(step.subject),
                                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                                      const SizedBox(height: 3),
                                      Text(
                                        step.subject.attempts.isEmpty
                                            ? t('في أول محاولة جيب على الأقل', 'In your first attempt, score at least')
                                            : t('ادخل المحاولة الجاية وجيب على الأقل', 'Retake and score at least'),
                                        style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                      ),
                                    ],
                                  ),
                                ),
                                if (step.subject.attempts.isNotEmpty) ...<Widget>[
                                  Text('${step.from}', style: const TextStyle(fontSize: 15, color: AppColors.muted, fontWeight: FontWeight.w700)),
                                  const Padding(
                                    padding: EdgeInsets.symmetric(horizontal: 6),
                                    child: Icon(Icons.arrow_forward, size: 16, color: AppColors.muted),
                                  ),
                                ],
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                  decoration: BoxDecoration(color: AppColors.amberSoft, borderRadius: BorderRadius.circular(10)),
                                  child: Text('${step.to}',
                                      style: const TextStyle(color: AppColors.amberInk, fontSize: 17, fontWeight: FontWeight.w700)),
                                ),
                              ],
                            ),
                          ),
                        ),
                      if (!result.reachable)
                        Panel(
                          child: Text(
                            t('حتى لو جبت 100 في كل المحاولات الباقية مش هتوصل للهدف ده. جرّب هدف أقل شوية.',
                                "Even 100 in every remaining attempt won't reach this goal. Try a slightly lower goal."),
                            style: const TextStyle(fontSize: 13, height: 1.6, color: AppColors.muted),
                          ),
                        ),
                    ],
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
