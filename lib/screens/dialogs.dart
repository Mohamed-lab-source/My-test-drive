import 'package:flutter/material.dart';

String formatDate(DateTime d) => '${d.day}/${d.month}/${d.year}';

/// Asks the user to type a short text. Returns null if cancelled or empty.
Future<String?> askText(
  BuildContext context, {
  required String title,
  required String hint,
  required String okLabel,
  required String cancelLabel,
  String initial = '',
  bool numbersOnly = false,
}) async {
  final controller = TextEditingController(text: initial);
  final result = await showDialog<String>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          autofocus: true,
          keyboardType: numbersOnly ? TextInputType.number : TextInputType.text,
          decoration: InputDecoration(hintText: hint),
          onSubmitted: (value) => Navigator.of(dialogContext).pop(value),
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: Text(cancelLabel)),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(controller.text), child: Text(okLabel)),
        ],
      );
    },
  );
  if (result == null || result.trim().isEmpty) return null;
  return result.trim();
}

/// Asks a yes/no question. Returns true only if the user confirmed.
Future<bool> confirm(
  BuildContext context, {
  required String title,
  required String message,
  required String yesLabel,
  required String noLabel,
}) async {
  final result = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(dialogContext).pop(false), child: Text(noLabel)),
          FilledButton(onPressed: () => Navigator.of(dialogContext).pop(true), child: Text(yesLabel)),
        ],
      );
    },
  );
  return result ?? false;
}
