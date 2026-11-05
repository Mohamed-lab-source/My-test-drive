import 'package:flutter/material.dart';

import '../app_state.dart';
import '../content.dart';
import '../questions.dart';
import '../theme.dart';
import 'practice_session.dart';
import 'track_setup.dart';

/// The full guide: rules, tracks, subjects and exam calendar.
class GuideTab extends StatelessWidget {
  const GuideTab({super.key, required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final ar = state.isArabic;
        final counted = subjectCatalog.where((s) => s.counted).toList();
        final outside = subjectCatalog.where((s) => !s.counted).toList();
        return Scaffold(
          appBar: AppBar(title: Text(t('دليل البكالوريا', 'Baccalaureate guide'), style: const TextStyle(fontWeight: FontWeight.w700))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
            children: <Widget>[
              Panel(
                color: AppColors.blueSoft,
                child: Text(
                  t('كل القواعد والمسارات والمواد في مكان واحد. آخر مراجعة: $rulesLastChecked. اتأكد دايماً من قرارات الوزارة الرسمية.',
                      'All the rules, tracks and subjects in one place. Last checked: $rulesLastChecked. Always confirm with official Ministry decisions.'),
                  style: const TextStyle(color: AppColors.blueDark, fontSize: 13, height: 1.6),
                ),
              ),
              const SizedBox(height: 20),
              _SectionTitle(t('القواعد', 'The rules')),
              for (final r in rules)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.white,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.line),
                    ),
                    child: Theme(
                      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        title: Text(ar ? r.titleAr : r.titleEn, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        expandedCrossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(ar ? r.bodyAr : r.bodyEn, style: const TextStyle(fontSize: 14, height: 1.7, color: Color(0xFF3E475B))),
                        ],
                      ),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _SectionTitle(t('مواعيد الامتحانات', 'Exam calendar')),
              Panel(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                child: Column(
                  children: <Widget>[
                    for (final w in examCalendar)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Container(
                          width: 64,
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: w.free ? AppColors.blueSoft : AppColors.amberSoft,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(ar ? w.monthAr : w.monthEn,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontWeight: FontWeight.w700, color: w.free ? AppColors.blueDark : AppColors.amberInk)),
                        ),
                        title: Text(ar ? w.whatAr : w.whatEn, style: const TextStyle(fontSize: 14)),
                        subtitle: Text(w.free ? t('مجانية', 'Free') : t('200 جنيه للمادة', '200 EGP per subject'),
                            style: const TextStyle(fontSize: 12)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _SectionTitle(t('المسارات الأربعة', 'The four tracks')),
              for (var i = 0; i < tracks.length; i++)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NavCard(
                    title: ar ? tracks[i].nameAr : tracks[i].nameEn,
                    subtitle: ar ? tracks[i].fieldsAr : tracks[i].fieldsEn,
                    highlight: state.track == i,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => TrackGuideScreen(state: state, trackIndex: i)),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _SectionTitle(t('المواد اللي بتدخل المجموع', 'Subjects counted in the total')),
              for (final s in counted)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NavCard(
                    title: ar ? s.nameAr : s.nameEn,
                    subtitle: ar ? s.yearAr : s.yearEn,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => SubjectGuideScreen(state: state, subjectKey: s.key)),
                    ),
                  ),
                ),
              const SizedBox(height: 16),
              _SectionTitle(t('مواد خارج المجموع', 'Subjects outside the total')),
              for (final s in outside)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NavCard(
                    title: ar ? s.nameAr : s.nameEn,
                    subtitle: ar ? s.yearAr : s.yearEn,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => SubjectGuideScreen(state: state, subjectKey: s.key)),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(text, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: AppColors.ink)),
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({required this.title, required this.subtitle, required this.onTap, this.highlight = false});

  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: highlight ? AppColors.blueSoft : AppColors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: highlight ? AppColors.blue : AppColors.line),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.ink)),
                    const SizedBox(height: 3),
                    Text(subtitle, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}

/// Details of one track.
class TrackGuideScreen extends StatelessWidget {
  const TrackGuideScreen({super.key, required this.state, required this.trackIndex});

  final AppState state;
  final int trackIndex;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: state,
      builder: (context, _) {
        final t = state.tr;
        final ar = state.isArabic;
        final info = tracks[trackIndex];
        String name(String key) {
          final s = subjectInfo(key);
          if (s == null) return key;
          return ar ? s.nameAr : s.nameEn;
        }

        Widget subjectRow(String key, String note) {
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.menu_book_outlined, color: AppColors.blue),
            title: Text(name(key), style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: Text(note, style: const TextStyle(fontSize: 12)),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => SubjectGuideScreen(state: state, subjectKey: key)),
            ),
          );
        }

        return Scaffold(
          appBar: AppBar(title: Text(ar ? info.nameAr : info.nameEn, style: const TextStyle(fontWeight: FontWeight.w700))),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
            children: <Widget>[
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(color: AppColors.blue, borderRadius: BorderRadius.circular(22)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(t('بيوديك لـ', 'Leads to'), style: const TextStyle(color: AppColors.white, fontSize: 13)),
                    const SizedBox(height: 6),
                    Text(ar ? info.fieldsAr : info.fieldsEn,
                        style: const TextStyle(color: AppColors.white, fontSize: 18, fontWeight: FontWeight.w700, height: 1.4)),
                    const SizedBox(height: 10),
                    Text(t('المسار مش بيضمن كلية معينة. القبول حسب قواعد التنسيق.', 'A track does not guarantee a specific faculty. Admission follows coordination rules.'),
                        style: const TextStyle(color: AppColors.white, fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(t('تانية ثانوي · 400 درجة', 'Year 2 · 400 points'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              for (final k in year2Core) subjectRow(k, t('أساسية · 100 درجة', 'Core · 100 points')),
              Padding(
                padding: const EdgeInsets.only(top: 8, bottom: 2),
                child: Text(t('واختار مادة واحدة من دول (100 درجة):', 'And choose ONE of these (100 points):'),
                    style: const TextStyle(fontSize: 13, color: AppColors.muted)),
              ),
              for (final k in info.electives) subjectRow(k, t('اختيارية', 'Elective')),
              const SizedBox(height: 16),
              Text(t('تالتة ثانوي · 200 درجة', 'Year 3 · 200 points'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              for (final k in info.year3) subjectRow(k, t('تخصص · 100 درجة', 'Specialised · 100 points')),
              const SizedBox(height: 16),
              Text(t('خارج المجموع', 'Outside the total'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              subjectRow('religion', t('لازم 70% للنجاح', '70% needed to pass')),
              subjectRow('financial', t('شهادة إتمام', 'Completion certificate')),
              subjectRow('pe', t('امتحان عملي', 'Practical exam')),
              const SizedBox(height: 20),
              SizedBox(
                height: 54,
                child: FilledButton(
                  onPressed: () => showTrackSetup(context, state, trackIndex),
                  child: Text(
                    state.track == trackIndex ? t('غيّر المادة الاختيارية', 'Change my elective') : t('اختار المسار ده', 'Choose this track'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
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

/// Guide page for one subject.
class SubjectGuideScreen extends StatelessWidget {
  const SubjectGuideScreen({super.key, required this.state, required this.subjectKey});

  final AppState state;
  final String subjectKey;

  @override
  Widget build(BuildContext context) {
    final t = state.tr;
    final ar = state.isArabic;
    final info = subjectInfo(subjectKey);
    if (info == null) return const Scaffold(body: SizedBox.shrink());
    final group = questionGroup(subjectKey);
    final indices = <int>[
      for (var i = 0; i < questionBank.length; i++)
        if (questionBank[i].subject == group) i,
    ];
    final inTracks = <String>[
      for (final tr in tracks)
        if (tr.electives.contains(subjectKey) || tr.year3.contains(subjectKey)) ar ? tr.nameAr : tr.nameEn,
    ];
    final tips = <String>[...(ar ? info.tipsAr : info.tipsEn), ...generalTips(ar)];

    return Scaffold(
      appBar: AppBar(title: Text(ar ? info.nameAr : info.nameEn, style: const TextStyle(fontWeight: FontWeight.w700))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 28),
        children: <Widget>[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              _chip(info.counted ? t('بتدخل المجموع', 'Counted in total') : t('خارج المجموع', 'Outside the total'),
                  info.counted ? AppColors.blueSoft : AppColors.amberSoft, info.counted ? AppColors.blueDark : AppColors.amberInk),
              _chip(ar ? info.yearAr : info.yearEn, AppColors.white, AppColors.ink),
            ],
          ),
          const SizedBox(height: 16),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(t('عن المادة', 'About this subject'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(ar ? info.aboutAr : info.aboutEn, style: const TextStyle(fontSize: 14, height: 1.7, color: Color(0xFF3E475B))),
                if (inTracks.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 10),
                  Text(t('في مسار: ${inTracks.join('، ')}', 'In track: ${inTracks.join(', ')}'),
                      style: const TextStyle(fontSize: 13, color: AppColors.muted)),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(t('إزاي تذاكرها', 'How to study it'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                for (final tip in tips)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        const Padding(
                          padding: EdgeInsets.only(top: 3),
                          child: Icon(Icons.check_circle, size: 16, color: AppColors.blue),
                        ),
                        const SizedBox(width: 8),
                        Expanded(child: Text(tip, style: const TextStyle(fontSize: 14, height: 1.6))),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          if (indices.isNotEmpty)
            SizedBox(
              height: 54,
              child: FilledButton.icon(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => PracticeSession(
                      state: state,
                      indices: indices,
                      title: ar ? info.nameAr : info.nameEn,
                    ),
                  ),
                ),
                icon: const Icon(Icons.play_arrow_rounded),
                label: Text(t('اتدرب على ${indices.length} سؤال', 'Practise ${indices.length} questions'),
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _chip(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12), border: Border.all(color: AppColors.line)),
      child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: fg)),
    );
  }
}
