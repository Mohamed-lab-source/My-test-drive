import '../app/i18n.dart';

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

  /// Open intervals for a weekday (1 = Monday), [] when closed all day,
  /// null when the hours don't say.
  List<(int, int)>? intervalsOn(int weekday) =>
      alwaysOpen ? const [(0, 1440)] : _week[weekday];

  /// "Open · closes 23:00" / "Closed · opens 10:00 tomorrow", or null when
  /// we can't tell from the hours.
  String? statusText(DateTime now) {
    if (alwaysOpen) return tr('Open 24 hours');
    final open = isOpenAt(now);
    if (open == null) return null;
    final minute = now.hour * 60 + now.minute;
    if (open) {
      // Find the interval we're in (today's, or a late one from yesterday).
      for (final (s, e) in _week[now.weekday] ?? const <(int, int)>[]) {
        if (minute >= s && minute < e) {
          return e >= 1440 && s == 0 && e - s >= 1440
              ? tr('Open all day')
              : trf('Open · closes {t}', {'t': _hhmm(e)});
        }
      }
      for (final (_, e) in _week[(now.weekday + 5) % 7 + 1] ?? const <(int, int)>[]) {
        if (e > 1440 && minute < e - 1440) return trf('Open · closes {t}', {'t': _hhmm(e)});
      }
      return tr('Open');
    }
    // Closed: look for the next opening in the coming week.
    for (var add = 0; add < 7; add++) {
      final day = (now.weekday - 1 + add) % 7 + 1;
      for (final (s, _) in _week[day] ?? const <(int, int)>[]) {
        if (add == 0 && s <= minute) continue;
        if (add == 0) return trf('Closed · opens {t}', {'t': _hhmm(s)});
        if (add == 1) return trf('Closed · opens {t} tomorrow', {'t': _hhmm(s)});
        return trf('Closed · opens {t} {day}', {'t': _hhmm(s), 'day': tr(_dayNames[day - 1])});
      }
    }
    return tr('Closed');
  }

  /// Minutes until it closes, when open now and the hours say; else null.
  int? minutesUntilClose(DateTime now) {
    if (alwaysOpen || isOpenAt(now) != true) return null;
    final minute = now.hour * 60 + now.minute;
    for (final (s, e) in _week[now.weekday] ?? const <(int, int)>[]) {
      if (minute >= s && minute < e) return e >= 1440 && s == 0 ? null : e - minute;
    }
    for (final (_, e) in _week[(now.weekday + 5) % 7 + 1] ?? const <(int, int)>[]) {
      if (e > 1440 && minute < e - 1440) return e - 1440 - minute;
    }
    return null;
  }

  /// One line per weekday for a table, e.g. ("Mon", "10:00–23:00").
  /// Null when the hours don't cover the whole week.
  List<(String, String)>? weekTable() {
    if (alwaysOpen) return [for (final d in _dayNames) (tr(d), tr('Open 24 hours'))];
    final out = <(String, String)>[];
    for (var d = 1; d <= 7; d++) {
      final list = _week[d];
      if (list == null) return null;
      out.add((
        tr(_dayNames[d - 1]),
        list.isEmpty
            ? tr('Closed')
            : list
                .map((i) => i.$1 == 0 && i.$2 >= 1440 ? tr('24 hours') : '${_hhmm(i.$1)}–${_hhmm(i.$2)}')
                .join(', '),
      ));
    }
    return out;
  }

  static const _dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  static String _hhmm(int minutes) {
    final m = minutes % 1440;
    return '${(m ~/ 60).toString().padLeft(2, '0')}:${(m % 60).toString().padLeft(2, '0')}';
  }
}
