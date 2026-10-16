/// Outing reminders: notifications scheduled on the phone itself (free, no
/// server, work offline). The times are pure functions, tested in
/// test/reminders_test.dart; [Reminders] talks to Android.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_10y.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import 'i18n.dart';

/// When to remind, as offered in the app (key → English label).
const reminderOptions = <String, String>{
  '30m': '30 minutes before',
  '1h': '1 hour before',
  '2h': '2 hours before',
  'morning': 'The same morning (9:00)',
  'eve': 'The evening before (20:00)',
};

/// "2026-10-16" + "18:30" → that moment on the phone's clock.
DateTime? outingStart(String? ymd, String? hhmm) {
  final day = ymd == null ? null : DateTime.tryParse(ymd);
  if (day == null) return null;
  final p = (hhmm ?? '').split(':');
  final h = p.length == 2 ? int.tryParse(p[0]) : null;
  final m = p.length == 2 ? int.tryParse(p[1]) : null;
  if (h == null || m == null || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return DateTime(day.year, day.month, day.day, h, m);
}

/// The reminder moment for an outing starting at [start], or null when that
/// option doesn't make sense (e.g. "same morning" for a 10:00 outing).
DateTime? reminderTime(DateTime start, String option) => switch (option) {
  '30m' => start.subtract(const Duration(minutes: 30)),
  '1h' => start.subtract(const Duration(hours: 1)),
  '2h' => start.subtract(const Duration(hours: 2)),
  'morning' => start.hour >= 11 ? DateTime(start.year, start.month, start.day, 9) : null,
  'eve' => DateTime(start.year, start.month, start.day - 1, 20),
  _ => null,
};

/// "starts in 1 hour" style line for the notification.
String reminderLead(String option) => switch (option) {
  '30m' => tr('starts in 30 minutes'),
  '1h' => tr('starts in 1 hour'),
  '2h' => tr('starts in 2 hours'),
  'morning' => tr('is today'),
  _ => tr('is tomorrow'),
};

/// A stable notification id for a reminder key like "plan:abc".
int reminderId(String key) {
  var h = 0x811c9dc5;
  for (final c in key.codeUnits) {
    h = ((h ^ c) * 0x01000193) & 0x7fffffff;
  }
  return h;
}

/// Saved reminder ("1h|2026-10-16T17:30:00.000") → option and moment.
(String, DateTime)? parseReminder(String? raw) {
  final p = raw?.split('|');
  if (p == null || p.length != 2) return null;
  final t = DateTime.tryParse(p[1]);
  return t == null ? null : (p[0], t);
}

/// Thin wrapper around the notifications plugin. Every call is safe to make
/// when notifications aren't available (tests, other platforms).
class Reminders {
  Reminders._();

  static final _plugin = FlutterLocalNotificationsPlugin();
  static bool _ready = false;

  /// Where to go when a reminder is tapped (set by the app).
  static void Function(String route)? onOpen;

  /// The screen to open when the app was started by tapping a reminder.
  static String? launchRoute;

  static Future<void> init() async {
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return;
    try {
      tzdata.initializeTimeZones();
      tz.setLocalLocation(tz.getLocation('Africa/Cairo'));
      await _plugin.initialize(
        settings: const InitializationSettings(android: AndroidInitializationSettings('ic_stat_khroga')),
        onDidReceiveNotificationResponse: (r) {
          final route = r.payload;
          if (route != null && route.startsWith('/')) onOpen?.call(route);
        },
      );
      final launch = await _plugin.getNotificationAppLaunchDetails();
      final route = launch?.notificationResponse?.payload;
      if ((launch?.didNotificationLaunchApp ?? false) && route != null && route.startsWith('/')) {
        launchRoute = route;
      }
      _ready = true;
    } catch (_) {
      // No reminders on this phone; everything else still works.
    }
  }

  static bool get available => _ready;

  /// Asks for permission to show notifications (Android 13+). True if allowed.
  static Future<bool> askPermission() async {
    if (!_ready) return false;
    final android = _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    return await android?.requestNotificationsPermission() ?? true;
  }

  static Future<void> schedule({
    required String key,
    required DateTime at,
    required String title,
    required String body,
    required String route,
  }) async {
    if (!_ready) return;
    await _plugin.zonedSchedule(
      id: reminderId(key),
      scheduledDate: tz.TZDateTime.from(at, tz.local),
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          'outings',
          tr('Outing reminders'),
          channelDescription: tr('Reminders you set for your plans and group outings'),
          importance: Importance.high,
          priority: Priority.high,
        ),
      ),
      // Inexact: no special alarm permission needed; may be a few minutes late.
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      title: title,
      body: body,
      payload: route,
    );
  }

  static Future<void> cancel(String key) async {
    if (!_ready) return;
    try {
      await _plugin.cancel(id: reminderId(key));
    } catch (_) {}
  }
}
