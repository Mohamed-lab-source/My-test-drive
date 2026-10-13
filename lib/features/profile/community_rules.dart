import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/theme_settings.dart' show sharedPrefsProvider;

/// Google Play asks apps where people post (reviews, chats) to have people
/// agree to the rules before their first post. Asked once per phone.
Future<bool> ensureCommunityRules(BuildContext context, WidgetRef ref) async {
  final prefs = ref.read(sharedPrefsProvider);
  if (prefs?.getBool('community.accepted') ?? false) return true;
  final ok = await showDialog<bool>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(tr('Khroga community rules')),
      content: SingleChildScrollView(
        child: Text(tr('Before you post:\n\n'
            '• Be kind. No insults, hate, threats or harassment.\n'
            '• Be honest. Review only places you really visited.\n'
            '• No ads, spam, links or phone numbers.\n'
            '• Don\'t share other people\'s private details.\n\n'
            'Anyone can report posts. Posts that break these rules are removed, and people who keep '
            'breaking them are blocked.')),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(c, false);
            context.push('/terms');
          },
          child: Text(tr('Read the terms')),
        ),
        TextButton(onPressed: () => Navigator.pop(c, false), child: Text(tr('Cancel'))),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: Text(tr('I agree'))),
      ],
    ),
  );
  if (ok == true) await prefs?.setBool('community.accepted', true);
  return ok == true;
}
