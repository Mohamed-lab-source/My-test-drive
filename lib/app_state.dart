import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// One subject and the scores of every attempt the student took.
class Subject {
  Subject({required this.id, required this.nameAr, required this.nameEn, List<int>? attempts})
      : attempts = attempts ?? <int>[];

  final String id;
  String nameAr;
  String nameEn;
  final List<int> attempts;

  /// Only the best attempt counts.
  int get best => attempts.isEmpty ? 0 : attempts.reduce(max);

  bool get canRetake => attempts.length < AppState.maxAttempts;

  Map<String, dynamic> toJson() => {
        'id': id,
        'nameAr': nameAr,
        'nameEn': nameEn,
        'attempts': attempts,
      };

  factory Subject.fromJson(Map<String, dynamic> j) {
    final raw = (j['attempts'] as List?) ?? <dynamic>[];
    return Subject(
      id: j['id'] as String,
      nameAr: (j['nameAr'] as String?) ?? '',
      nameEn: (j['nameEn'] as String?) ?? '',
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

/// Everything the app remembers. Saved on the phone, no internet needed.
class AppState extends ChangeNotifier {
  static const int maxAttempts = 4;
  static const int maxScore = 100;
  static const String _key = 'masar_state_v1';

  bool onboarded = false;
  bool isArabic = true;
  String name = '';
  int? track;
  int goal = 360;
  DateTime? nextDate;
  String? nextSubjectId;
  List<Subject> subjects = <Subject>[];
  int _nextId = 10;

  // ---------- helpers ----------

  String tr(String ar, String en) => isArabic ? ar : en;

  String subjectName(Subject s) {
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

  static List<Subject> _defaultSubjects() => <Subject>[
        Subject(id: 's1', nameAr: 'اللغة العربية', nameEn: 'Arabic'),
        Subject(id: 's2', nameAr: 'الرياضيات', nameEn: 'Mathematics'),
        Subject(id: 's3', nameAr: 'الفيزياء', nameEn: 'Physics'),
        Subject(id: 's4', nameAr: 'اللغة الإنجليزية', nameEn: 'English'),
      ];

  // ---------- saving ----------

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) {
      subjects = _defaultSubjects();
      return;
    }
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      onboarded = (j['onboarded'] as bool?) ?? false;
      isArabic = (j['isArabic'] as bool?) ?? true;
      name = (j['name'] as String?) ?? '';
      track = j['track'] as int?;
      goal = (j['goal'] as int?) ?? 360;
      nextSubjectId = j['nextSubjectId'] as String?;
      final nd = j['nextDate'] as String?;
      nextDate = nd == null ? null : DateTime.tryParse(nd);
      _nextId = (j['nextId'] as int?) ?? 10;
      final list = (j['subjects'] as List?) ?? <dynamic>[];
      subjects = list.map((e) => Subject.fromJson(Map<String, dynamic>.from(e as Map))).toList();
    } catch (_) {
      subjects = _defaultSubjects();
    }
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
        'goal': goal,
        'nextSubjectId': nextSubjectId,
        'nextDate': nextDate?.toIso8601String(),
        'nextId': _nextId,
        'subjects': subjects.map((s) => s.toJson()).toList(),
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
    s.nameAr = n;
    s.nameEn = n;
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
