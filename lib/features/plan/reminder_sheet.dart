import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/reminders.dart';
import '../../app/theme.dart';
import '../../widgets/common.dart';

/// Reminders you set, on this phone: key (`plan:ID` / `group:ID`) →
/// `option|ISO time`.
final remindersProvider = NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('reminders'));

/// Cancels a reminder (e.g. its plan was deleted).
void forgetReminder(WidgetRef ref, String key) {
  if (ref.read(remindersProvider)[key] == null) return;
  Reminders.cancel(key);
  ref.read(remindersProvider.notifier).set(key, null);
}

/// The reminder still to come for [key], if any.
(String, DateTime)? activeReminder(Map<String, String> all, String key, DateTime now) {
  final r = parseReminder(all[key]);
  return r == null || r.$2.isBefore(now) ? null : r;
}

/// Bell button for an app bar: filled when a reminder is set.
class ReminderButton extends ConsumerWidget {
  const ReminderButton({
    super.key,
    required this.reminderKey,
    required this.title,
    required this.route,
    this.day,
    this.start,
    this.firstStop,
    this.fixedStart,
  });

  final String reminderKey;
  final String title;
  final String route;

  /// For plans: the planned day (may be changed in the sheet) and "HH:mm".
  final DateTime? day;
  final String? start;
  final String? firstStop;

  /// For group outings: the fixed meeting time.
  final DateTime? fixedStart;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!Reminders.available) return const SizedBox.shrink();
    final on = activeReminder(ref.watch(remindersProvider), reminderKey, DateTime.now()) != null;
    return IconButton(
      tooltip: on ? tr('Reminder set') : tr('Remind me'),
      icon: Icon(on ? Icons.notifications_active : Icons.notifications_none),
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _ReminderSheet(button: this),
      ),
    );
  }
}

class _ReminderSheet extends ConsumerStatefulWidget {
  const _ReminderSheet({required this.button});

  final ReminderButton button;

  @override
  ConsumerState<_ReminderSheet> createState() => _ReminderSheetState();
}

class _ReminderSheetState extends ConsumerState<_ReminderSheet> {
  late DateTime _day = widget.button.day ?? DateTime.now();

  DateTime? get _start =>
      widget.button.fixedStart ?? outingStart(DateFormat('yyyy-MM-dd').format(_day), widget.button.start);

  Future<void> _pick(String? option) async {
    final b = widget.button;
    final prefs = ref.read(remindersProvider.notifier);
    await Reminders.cancel(b.reminderKey);
    if (option == null) {
      prefs.set(b.reminderKey, null);
      if (mounted) {
        Navigator.pop(context);
        showMessage(context, tr('Reminder off'));
      }
      return;
    }
    final start = _start;
    final at = start == null ? null : reminderTime(start, option);
    if (at == null || !at.isAfter(DateTime.now())) {
      if (mounted) showMessage(context, tr('That time has already passed. Pick a shorter one or another day.'));
      return;
    }
    if (!await Reminders.askPermission()) {
      if (mounted) showMessage(context, tr('Notifications are off for Khroga. Turn them on in your phone settings.'));
      return;
    }
    try {
      await Reminders.schedule(
        key: b.reminderKey,
        at: at,
        title: '⏰ ${b.title} ${reminderLead(option)}',
        body: b.firstStop == null
            ? trf('Starts at {time}. Tap to open.', {'time': DateFormat('HH:mm').format(start!)})
            : trf('First stop: {place} at {time}. Tap to open your plan.', {
                'place': b.firstStop!,
                'time': DateFormat('HH:mm').format(start!),
              }),
        route: b.route,
      );
      prefs.set(b.reminderKey, '$option|${at.toIso8601String()}');
      if (mounted) {
        Navigator.pop(context);
        showMessage(context, trf("We'll remind you on {when}.", {'when': DateFormat('EEE d MMM, HH:mm').format(at)}));
      }
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final b = widget.button;
    final now = DateTime.now();
    final current = activeReminder(ref.watch(remindersProvider), b.reminderKey, now);
    final start = _start;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(KSpace.lg, KSpace.lg, KSpace.lg, KSpace.md),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(tr('Remind me'), style: text.titleLarge),
            const SizedBox(height: KSpace.xs),
            if (start == null)
              Text(tr('This plan has no start time yet, so we can\'t set a reminder.'), style: text.bodyMedium)
            else ...[
              Text(
                trf('Outing starts {when}', {'when': DateFormat('EEEE d MMM, HH:mm').format(start)}),
                style: text.bodyMedium,
              ),
              if (b.fixedStart == null)
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    icon: const Icon(Icons.event),
                    label: Text(tr('Change the day')),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _day.isBefore(now) ? now : _day,
                        firstDate: DateTime(now.year, now.month, now.day),
                        lastDate: now.add(const Duration(days: 365)),
                      );
                      if (picked != null) setState(() => _day = picked);
                    },
                  ),
                ),
              const SizedBox(height: KSpace.xs),
              for (final e in reminderOptions.entries)
                if (reminderTime(start, e.key) case final at? when at.isAfter(now))
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      current?.$1 == e.key ? Icons.radio_button_checked : Icons.radio_button_off,
                      color: current?.$1 == e.key ? context.k.accent : null,
                    ),
                    title: Text(tr(e.value)),
                    subtitle: Text(DateFormat('EEE d MMM, HH:mm').format(at)),
                    onTap: () => _pick(e.key),
                  ),
              if (reminderOptions.keys.every((o) => !(reminderTime(start, o)?.isAfter(now) ?? false)))
                Text(tr('This outing has already started.'), style: text.bodyMedium),
              if (current != null) TextButton(onPressed: () => _pick(null), child: Text(tr('Turn the reminder off'))),
              Text(
                tr('Reminders come from your phone, even offline. They can be a few minutes late.'),
                style: text.bodySmall?.copyWith(color: context.k.inkMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
