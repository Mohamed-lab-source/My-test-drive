import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../widgets/common.dart';

/// Create a group, optionally attached to a plan.
Future<void> showCreateGroupSheet(
  BuildContext context, {
  String? planId,
  String? suggestedName,
}) {
  return showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) =>
        _CreateGroupSheet(planId: planId, suggestedName: suggestedName),
  );
}

class _CreateGroupSheet extends ConsumerStatefulWidget {
  const _CreateGroupSheet({this.planId, this.suggestedName});

  final String? planId;
  final String? suggestedName;

  @override
  ConsumerState<_CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<_CreateGroupSheet> {
  late final _name = TextEditingController(text: widget.suggestedName ?? '');
  DateTime? _when;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await pickDateTime(context, _when);
    if (picked != null) setState(() => _when = picked);
  }

  Future<void> _create() async {
    final name = _name.text.trim();
    if (name.isEmpty) throw Exception('Give your group a name.');
    final router = GoRouter.of(context);
    final id = await ref.read(groupsRepositoryProvider).create(
          name: name,
          planId: widget.planId,
          scheduledAt: _when,
        );
    if (!mounted) return;
    Navigator.of(context).pop();
    router.push('/group/$id');
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(KSpace.lg, KSpace.lg, KSpace.lg,
          KSpace.lg + MediaQuery.viewInsetsOf(context).bottom),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('New group', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: KSpace.md),
          TextField(
            controller: _name,
            autofocus: true,
            maxLength: 40,
            textCapitalization: TextCapitalization.sentences,
            decoration: const InputDecoration(hintText: 'e.g. Friday squad'),
          ),
          OutlinedButton.icon(
            onPressed: _pickDate,
            icon: const Icon(Icons.event_outlined),
            label: Text(_when == null
                ? 'Pick a date (optional)'
                : DateFormat('EEE d MMM, h:mm a').format(_when!)),
          ),
          const SizedBox(height: KSpace.md),
          BusyButton(label: 'Create group', onPressed: _create),
        ],
      ),
    );
  }
}

/// Date + time picker in one go. Returns null if cancelled.
Future<DateTime?> pickDateTime(BuildContext context, DateTime? initial) async {
  final now = DateTime.now();
  final date = await showDatePicker(
    context: context,
    initialDate: initial ?? now,
    firstDate: DateTime(now.year, now.month, now.day),
    lastDate: now.add(const Duration(days: 365)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(initial ?? now.add(const Duration(hours: 2))),
  );
  if (time == null) return null;
  return DateTime(date.year, date.month, date.day, time.hour, time.minute);
}
