/// Reads the common forms of OpenStreetMap's `opening_hours`, e.g.
/// "Mo-Fr 09:00-23:00; Sa,Su 10:00-02:00", "24/7", "Su off".
///
/// If the text uses anything we don't understand (months, holidays only,
/// "sunrise"...), [parse] returns null and the app shows the hours as
/// written instead of guessing open/closed.
class OpeningHours {
  OpeningHours._(this._week, {this.alwaysOpen = false});

  /// For each weekday (1 = Monday … 7 = Sunday): open intervals in minutes
  /// from midnight. An end above 1440 means it closes after midnight.
  final Map<int, List<(int, int)>> _week;
  final bool alwaysOpen;

  static const _days = {'Mo': 1, 'Tu': 2, 'We': 3, 'Th': 4, 'Fr': 5, 'Sa': 6, 'Su': 7};
  static final _dayToken = RegExp(r'^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?$');
  static final _timeRange = RegExp(r'^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$');

  static OpeningHours? parse(String? raw) {
    if (raw == null) return null;
    final text = raw.trim();
    if (text.isEmpty) return null;
    if (text == '24/7') return OpeningHours._(const {}, alwaysOpen: true);

    final week = <int, List<(int, int)>>{};
    for (final rule in text.split(RegExp(r'\s*(;|\|\|)\s*'))) {
      if (rule.isEmpty) continue;
      final parts = rule.split(RegExp(r'\s+'));
      var days = {1, 2, 3, 4, 5, 6, 7};
      var rest = parts;

      // Optional day selector, e.g. "Mo-Fr" or "Sa,Su" or "Mo-We,Fr".
      final first = parts.first;
      if (RegExp(r'^[A-Z]').hasMatch(first)) {
        final selected = <int>{};
        for (final token in first.split(',')) {
          if (token == 'PH' || token == 'SH') continue; // holidays: ignore
          final m = _dayToken.firstMatch(token);
          if (m == null) return null; // months, week numbers... not supported
          final from = _days[m.group(1)]!;
          final to = m.group(3) == null ? from : _days[m.group(3)]!;
          for (var d = from;; d = d % 7 + 1) {
            selected.add(d);
            if (d == to) break;
          }
        }
        if (selected.isEmpty) continue; // a holiday-only rule
        days = selected;
        rest = parts.sublist(1);
      }

      final timeText = rest.join(' ').trim();
      if (timeText == 'off' || timeText == 'closed') {
        for (final d in days) {
          week[d] = const [];
        }
        continue;
      }
      if (timeText == '24/7' || timeText == '00:00-24:00') {
        for (final d in days) {
          week[d] = const [(0, 1440)];
        }
        continue;
      }
      final intervals = <(int, int)>[];
      for (final range in timeText.split(',')) {
        final m = _timeRange.firstMatch(range.trim());
        if (m == null) return null;
        final start = int.parse(m.group(1)!) * 60 + int.parse(m.group(2)!);
        var end = int.parse(m.group(3)!) * 60 + int.parse(m.group(4)!);
        if (start >= 1440 || end > 48 * 60) return null;
        if (end <= start) end += 1440; // closes after midnight
        intervals.add((start, end));
      }
      if (intervals.isEmpty) return null;
      for (final d in days) {
        week[d] = intervals; // later rules replace earlier ones for those days
      }
    }
    if (week.isEmpty) return null;
    return OpeningHours._(week);
  }

  /// true = open, false = closed, null = the hours don't cover this day.
  bool? isOpenAt(DateTime t) {
    if (alwaysOpen) return true;
    final minute = t.hour * 60 + t.minute;
    final today = _week[t.weekday];
    final yesterday = _week[(t.weekday + 5) % 7 + 1];
    if (today == null && yesterday == null) return null;
    for (final (s, e) in today ?? const <(int, int)>[]) {
      if (minute >= s && minute < e) return true;
    }
    // Late-night hours carried over from yesterday (e.g. 18:00-02:00).
    for (final (_, e) in yesterday ?? const <(int, int)>[]) {
      if (e > 1440 && minute < e - 1440) return true;
    }
    if (today == null) return null;
    return false;
  }
}
