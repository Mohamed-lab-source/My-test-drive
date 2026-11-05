import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'content.dart';

/// One subject and the scores of every attempt the student took.
class Subject {
  Subject({required this.id, required this.nameAr, required this.nameEn, this.key, this.year = 2, List<int>? attempts})
      : attempts = attempts ?? <int>[];

  final String id;
  String nameAr;
  String nameEn;

  /// Key in subjectCatalog, or null for a subject the student typed in.
  final String? key;

  /// 2 = Year 2 (Tanya Thanawy), 3 = Year 3 (Talta Thanawy).
  final int year;
  final List<int> attempts;

  /// Only the best attempt counts.
  int get best => attempts.isEmpty ? 0 : attempts.reduce(max);

  bool get canRetake => attempts.length < AppState.maxAttempts;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nameAr': nameAr,
        'nameEn': nameEn,
        'key': key,
        'year': year,
        'attempts': attempts,
      };

  factory Subject.fromJson(Map<String, dynamic> j) {
    final raw = (j['attempts'] as List?) ?? <dynamic>[];
    return Subject(
      id: j['id'] as String,
      nameAr: (j['nameAr'] as String?) ?? '',
      nameEn: (j['nameEn'] as String?) ?? '',
      key: j['key'] as String?,
      year: (j['year'] as int?) ?? 2,
      attempts: raw.map((e) => (e as num).toInt()).toList(),
    );
  }
}

/// One line of the plan: raise [subject] from [from] to [to].
class PlanStep {
  PlanStep(this.subject, this.from, this.to);

  final Subject subject;
  final int from;
  final int to;
}

class PlanResult {
  PlanResult(this.steps, this.reachable);

  final List<PlanStep> steps;
  final bool reachable;
}

/// Practice questions are grouped so Year 2 and Year 3 versions share questions.
String questionGroup(String key) {
  switch (key) {
    case 'math_adv':
      return 'math';
    case 'physics_adv':
      return 'physics';
    case 'chemistry_adv':
      return 'chemistry';
    default:
      return key;
  }
}

String _dayKey(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

/// Everything the app remembers. Saved on the phone, no internet needed.
class AppState extends ChangeNotifier {
  /// Year 2 subjects can be sat in May and July of Year 2 and again in Year 3.
  static const int maxAttempts = 4;
  static const int maxScore = 100;
  static const String _key = 'masar_state_v1';

  bool onboarded = false;
  bool isArabic = true;
  String name = '';
  int? track;
  int? elective;
  int goal = 360;
  DateTime? nextDate;
  String? nextSubjectId;
  List<Subject> subjects = <Subject>[];
  int _nextId = 10;

  // Practice progress
  Map<String, int> answered = <String, int>{};
  Map<String, int> correct = <String, int>{};
  Set<int> mistakes = <int>{};

  // Study timer: minutes per day ("2026-11-05": 50)
  Map<String, int> studyMinutes = <String, int>{};

  // ---------- helpers ----------

  String tr(String ar, String en) => isArabic ? ar : en;

  String subjectName(Subject s) {
    final info = subjectInfo(s.key);
    if (info != null) return isArabic ? info.nameAr : info.nameEn;
    final n = isArabic ? s.nameAr : s.nameEn;
    if (n.isNotEmpty) return n;
    return isArabic ? s.nameEn : s.nameAr;
  }

  int get total => subjects.fold<int>(0, (sum, s) => sum + s.best);

  int get maxTotal => subjects.length * maxScore;

  Subject? subjectById(String? id) {
    for (final s in subjects) {
      if (s.id == id) return s;
    }
    return null;
  }

  /// Question groups that match the student subjects.
  Set<String> get myQuestionGroups => subjects.where((s) => s.key != null).map((s) => questionGroup(s.key!)).toSet();

  int get todayMinutes => studyMinutes[_dayKey(DateTime.now())] ?? 0;

  int get totalStudyMinutes => studyMinutes.values.fold<int>(0, (a, b) => a + b);

  /// Days in a row (ending today or yesterday) with some study time.
  int get streak {
    var day = DateTime.now();
    if ((studyMinutes[_dayKey(day)] ?? 0) == 0) {
      day = day.subtract(const Duration(days: 1));
    }
    var count = 0;
    while ((studyMinutes[_dayKey(day)] ?? 0) > 0) {
      count++;
      day = day.subtract(const Duration(days: 1));
    }
    return count;
  }

  static List<Subject> _defaultSubjects() => <Subject>[
        Subject(id: 's1', nameAr: 'اللغة العربية', nameEn: 'Arabic', key: 'arabic'),
        Subject(id: 's2', nameAr: 'اللغة الأجنبية الأولى', nameEn: 'First foreign language', key: 'foreign1'),
        Subject(id: 's3', nameAr: 'التاريخ المصري', nameEn: 'Egyptian history', key: 'history'),
      ];

  // ---------- saving ----------

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) {
      subjects = _defaultSubjects();
      goal = 255;
      return;
    }
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      onboarded = (j['onboarded'] as bool?) ?? false;
      isArabic = (j['isArabic'] as bool?) ?? true;
      name = (j['name'] as String?) ?? '';
      track = j['track'] as int?;
      elective = j['elective'] as int?;
      goal = (j['goal'] as int?) ?? 360;
      nextSubjectId = j['nextSubjectId'] as String?;
      final nd = j['nextDate'] as String?;
      nextDate = nd == null ? null : DateTime.tryParse(nd);
      _nextId = (j['nextId'] as int?) ?? 10;
      final list = (j['subjects'] as List?) ?? <dynamic>[];
      subjects = list.map((e) => Subject.fromJson(Map<String, dynamic>.from(e as Map))).map(_migrate).toList();
      answered = _intMap(j['answered']);
      correct = _intMap(j['correct']);
      mistakes = ((j['mistakes'] as List?) ?? <dynamic>[]).map((e) => (e as num).toInt()).toSet();
      studyMinutes = _intMap(j['studyMinutes']);
      if (goal > maxTotal) goal = maxTotal;
    } catch (_) {
      subjects = _defaultSubjects();
    }
  }

  /// Version 1 saved subjects without a catalog key; match them by name.
  static Subject _migrate(Subject s) {
    if (s.key != null) return s;
    String? key;
    if (s.nameEn == 'English') key = 'foreign1';
    for (final c in subjectCatalog) {
      if (key != null) break;
      if (c.nameEn == s.nameEn || c.nameAr == s.nameAr) key = c.key;
    }
    if (key == null) return s;
    return Subject(id: s.id, nameAr: s.nameAr, nameEn: s.nameEn, key: key, year: s.year, attempts: s.attempts);
  }

  static Map<String, int> _intMap(dynamic raw) {
    if (raw is! Map) return <String, int>{};
    return raw.map((k, v) => MapEntry(k.toString(), (v as num).toInt()));
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode({
        'onboarded': onboarded,
        'isArabic': isArabic,
        'name': name,
        'track': track,
        'elective': elective,
        'goal': goal,
        'nextSubjectId': nextSubjectId,
        'nextDate': nextDate?.toIso8601String(),
        'nextId': _nextId,
        'subjects': subjects.map((s) => s.toJson()).toList(),
        'answered': answered,
        'correct': correct,
        'mistakes': mistakes.toList(),
        'studyMinutes': studyMinutes,
      }),
    );
  }

  void _changed() {
    notifyListeners();
    _save();
  }

  // ---------- actions ----------

  void setArabic(bool value) {
    isArabic = value;
    _changed();
  }

  void toggleLanguage() => setArabic(!isArabic);

  void finishOnboarding(String studentName) {
    name = studentName.trim();
    onboarded = true;
    _changed();
  }

  void setName(String value) {
    name = value.trim();
    _changed();
  }

  void setTrack(int? value) {
    track = value;
    _changed();
  }

  /// Builds the official subject list for [trackIndex] with the chosen Year 2
  /// elective. Scores already recorded for the same subjects are kept.
  void applyTrack(int trackIndex, int electiveIndex) {
    final info = tracks[trackIndex];
    final keys = <String>[...year2Core, info.electives[electiveIndex]];
    final old = <String, Subject>{for (final s in subjects) if (s.key != null) s.key!: s};
    final next = <Subject>[];
    void addKey(String k, int year) {
      final existing = old[k];
      if (existing != null) {
        next.add(Subject(id: existing.id, nameAr: existing.nameAr, nameEn: existing.nameEn, key: k, year: year, attempts: existing.attempts));
        return;
      }
      final c = subjectInfo(k);
      _nextId++;
      next.add(Subject(id: 's$_nextId', nameAr: c?.nameAr ?? k, nameEn: c?.nameEn ?? k, key: k, year: year));
    }

    for (final k in keys) {
      addKey(k, 2);
    }
    for (final k in info.year3) {
      addKey(k, 3);
    }
    // Keep subjects the student added by hand.
    next.addAll(subjects.where((s) => s.key == null));
    subjects = next;
    track = trackIndex;
    elective = electiveIndex;
    if (subjectById(nextSubjectId) == null) nextSubjectId = null;
    goal = ((maxTotal * 0.85) / 5).round() * 5;
    _changed();
  }

  void setGoal(int value) {
    goal = value.clamp(0, max(maxTotal, 0)).toInt();
    _changed();
  }

  void setNextAttempt(DateTime? date, String? subjectId) {
    nextDate = date;
    nextSubjectId = subjectId;
    _changed();
  }

  void addSubject(String subjectName) {
    final n = subjectName.trim();
    if (n.isEmpty) return;
    _nextId++;
    subjects.add(Subject(id: 's$_nextId', nameAr: n, nameEn: n));
    _changed();
  }

  void renameSubject(String id, String newName) {
    final s = subjectById(id);
    final n = newName.trim();
    if (s == null || n.isEmpty) return;
    final index = subjects.indexOf(s);
    // Renaming turns it into a custom subject.
    subjects[index] = Subject(id: s.id, nameAr: n, nameEn: n, year: s.year, attempts: s.attempts);
    _changed();
  }

  void removeSubject(String id) {
    subjects.removeWhere((s) => s.id == id);
    if (nextSubjectId == id) nextSubjectId = null;
    if (goal > maxTotal) goal = maxTotal;
    _changed();
  }

  /// Returns false if the student already used all attempts.
  bool addAttempt(String id, int score) {
    final s = subjectById(id);
    if (s == null || !s.canRetake) return false;
    s.attempts.add(score.clamp(0, maxScore).toInt());
    _changed();
    return true;
  }

  void removeAttempt(String id, int index) {
    final s = subjectById(id);
    if (s == null || index < 0 || index >= s.attempts.length) return;
    s.attempts.removeAt(index);
    _changed();
  }

  void recordAnswer(int questionIndex, String group, bool isRight) {
    answered[group] = (answered[group] ?? 0) + 1;
    if (isRight) {
      correct[group] = (correct[group] ?? 0) + 1;
      mistakes.remove(questionIndex);
    } else {
      mistakes.add(questionIndex);
    }
    _changed();
  }

  void clearMistake(int questionIndex) {
    mistakes.remove(questionIndex);
    _changed();
  }

  void addStudyMinutes(int minutes) {
    if (minutes <= 0) return;
    final k = _dayKey(DateTime.now());
    studyMinutes[k] = (studyMinutes[k] ?? 0) + minutes;
    _changed();
  }

  /// Finds the easiest way to reach [goal]: raises the weakest subjects
  /// first, a little at a time, so the effort is spread fairly.
  PlanResult plan() {
    var gap = goal - total;
    if (gap <= 0) return PlanResult(<PlanStep>[], true);
    final candidates = subjects.where((s) => s.canRetake).toList();
    final target = <String, int>{for (final s in candidates) s.id: s.best};
    while (gap > 0) {
      Subject? lowest;
      for (final s in candidates) {
        final v = target[s.id]!;
        if (v < maxScore && (lowest == null || v < target[lowest.id]!)) {
          lowest = s;
        }
      }
      if (lowest == null) break;
      target[lowest.id] = target[lowest.id]! + 1;
      gap--;
    }
    final steps = <PlanStep>[];
    for (final s in candidates) {
      final to = target[s.id]!;
      if (to > s.best) steps.add(PlanStep(s, s.best, to));
    }
    steps.sort((a, b) => (b.to - b.from).compareTo(a.to - a.from));
    return PlanResult(steps, gap <= 0);
  }
}
