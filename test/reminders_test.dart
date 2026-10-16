import 'package:flutter_test/flutter_test.dart';
import 'package:khroga/app/reminders.dart';

void main() {
  test('outing start from a day and a time', () {
    expect(outingStart('2026-10-16', '18:30'), DateTime(2026, 10, 16, 18, 30));
    expect(outingStart('2026-10-16', null), isNull);
    expect(outingStart('2026-10-16', '25:00'), isNull);
    expect(outingStart('bad', '18:30'), isNull);
    expect(outingStart(null, '18:30'), isNull);
  });

  test('reminder times for each option', () {
    final start = DateTime(2026, 10, 16, 18, 30);
    expect(reminderTime(start, '30m'), DateTime(2026, 10, 16, 18));
    expect(reminderTime(start, '1h'), DateTime(2026, 10, 16, 17, 30));
    expect(reminderTime(start, '2h'), DateTime(2026, 10, 16, 16, 30));
    expect(reminderTime(start, 'morning'), DateTime(2026, 10, 16, 9));
    expect(reminderTime(start, 'eve'), DateTime(2026, 10, 15, 20));
    // "Same morning" makes no sense for a 10:00 outing.
    expect(reminderTime(DateTime(2026, 10, 16, 10), 'morning'), isNull);
    // The evening before the 1st of a month is the last day of the month before.
    expect(reminderTime(DateTime(2026, 11, 1, 12), 'eve'), DateTime(2026, 10, 31, 20));
    expect(reminderTime(start, 'nope'), isNull);
    for (final o in reminderOptions.keys) {
      expect(reminderTime(DateTime(2026, 10, 16, 20), o), isNotNull, reason: o);
    }
  });

  test('ids are stable and saved reminders parse', () {
    expect(reminderId('plan:abc'), reminderId('plan:abc'));
    expect(reminderId('plan:abc'), isNot(reminderId('group:abc')));
    expect(reminderId('plan:abc'), greaterThanOrEqualTo(0));
    expect(parseReminder('1h|2026-10-16T17:30:00.000'), ('1h', DateTime(2026, 10, 16, 17, 30)));
    expect(parseReminder('broken'), isNull);
    expect(parseReminder(null), isNull);
  });
}
