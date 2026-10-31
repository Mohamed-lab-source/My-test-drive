import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../app/helpers.dart' show placeChatText;

import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import 'explore_screen.dart';

/// Your own named lists of places (saved on this phone).
class ListsScreen extends ConsumerWidget {
  const ListsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lists = ref.watch(placeListsProvider);
    final all = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final byId = {for (final p in all) p.id: p};
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('My lists')),
        actions: [
          IconButton(
            tooltip: tr('New list'),
            icon: const Icon(Icons.add),
            onPressed: () => newListDialog(context, ref),
          ),
        ],
      ),
      body: lists.isEmpty
          ? EmptyState(
              emoji: '📋',
              title: tr('No lists yet'),
              message: tr('Make a list like "Birthday ideas", then add places from any place page.'),
              actionLabel: tr('New list'),
              onAction: () => newListDialog(context, ref),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
              children: [
                for (final e in lists.entries)
                  Card(
                    child: ExpansionTile(
                      shape: const Border(),
                      title: Text(e.key, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(trf('{n} places', {'n': e.value.length})),
                      children: [
                        for (final id in e.value)
                          if (byId[id] != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(KSpace.sm, 0, KSpace.sm, KSpace.sm),
                              child: PlaceTile(place: byId[id]!),
                            ),
                        if (e.value.any((id) => byId[id] != null))
                          Wrap(spacing: KSpace.xs, children: [
                            TextButton.icon(
                              icon: const Icon(Icons.share_outlined),
                              label: Text(tr('Share list')),
                              onPressed: () => SharePlus.instance.share(ShareParams(
                                  text: [
                                    '📋 ${e.key}',
                                    for (final id in e.value)
                                      if (byId[id] != null) placeChatText(byId[id]!),
                                  ].join('\n\n'))),
                            ),
                            TextButton.icon(
                              icon: const Icon(Icons.casino_outlined),
                              label: Text(tr('Pick one for us')),
                              onPressed: () {
                                final ids = e.value.where((id) => byId[id] != null).toList()..shuffle();
                                context.push('/place/${ids.first}');
                              },
                            ),
                          ]),
                        TextButton.icon(
                          onPressed: () async {
                            final controller = TextEditingController(text: e.key);
                            final name = await showDialog<String>(
                              context: context,
                              builder: (d) => AlertDialog(
                                title: Text(tr('Rename list')),
                                content: TextField(controller: controller, autofocus: true, maxLength: 40),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(d), child: Text(tr('Cancel'))),
                                  FilledButton(
                                      onPressed: () => Navigator.pop(d, controller.text),
                                      child: Text(tr('Save'))),
                                ],
                              ),
                            );
                            disposeLater(controller);
                            if (name != null) ref.read(placeListsProvider.notifier).rename(e.key, name);
                          },
                          icon: const Icon(Icons.edit_outlined),
                          label: Text(tr('Rename list')),
                        ),
                        TextButton.icon(
                          style: TextButton.styleFrom(
                              foregroundColor: Theme.of(context).colorScheme.error),
                          onPressed: () async {
                            final ok = await showDialog<bool>(
                              context: context,
                              builder: (d) => AlertDialog(
                                title: Text(trf('Delete "{name}"?', {'name': e.key})),
                                content: Text(tr('The places stay in Khroga; only this list goes.')),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr('Cancel'))),
                                  FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr('Delete'))),
                                ],
                              ),
                            );
                            if (ok == true) ref.read(placeListsProvider.notifier).delete(e.key);
                          },
                          icon: const Icon(Icons.delete_outline),
                          label: Text(tr('Delete this list')),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}

/// Asks for a name and creates a list. Returns the name, or null.
Future<String?> newListDialog(BuildContext context, WidgetRef ref) async {
  final controller = TextEditingController();
  final name = await showDialog<String>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: Text(tr('New list')),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 40,
        decoration: InputDecoration(hintText: tr('e.g. Birthday ideas')),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(tr('Cancel'))),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: Text(tr('Create'))),
      ],
    ),
  );
  disposeLater(controller);
  if (name == null || name.trim().isEmpty) return null;
  ref.read(placeListsProvider.notifier).create(name);
  return name.trim();
}
