import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
        title: const Text('My lists'),
        actions: [
          IconButton(
            tooltip: 'New list',
            icon: const Icon(Icons.add),
            onPressed: () => newListDialog(context, ref),
          ),
        ],
      ),
      body: lists.isEmpty
          ? EmptyState(
              emoji: '📋',
              title: 'No lists yet',
              message: 'Make a list like "Birthday ideas", then add places from any place page.',
              actionLabel: 'New list',
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
                      subtitle: Text('${e.value.length} places'),
                      children: [
                        for (final id in e.value)
                          if (byId[id] != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(KSpace.sm, 0, KSpace.sm, KSpace.sm),
                              child: PlaceTile(place: byId[id]!),
                            ),
                        TextButton.icon(
                          style: TextButton.styleFrom(
                              foregroundColor: Theme.of(context).colorScheme.error),
                          onPressed: () => ref.read(placeListsProvider.notifier).delete(e.key),
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Delete this list'),
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
      title: const Text('New list'),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLength: 40,
        decoration: const InputDecoration(hintText: 'e.g. Birthday ideas'),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
        FilledButton(
            onPressed: () => Navigator.pop(dialogContext, controller.text),
            child: const Text('Create')),
      ],
    ),
  );
  controller.dispose();
  if (name == null || name.trim().isEmpty) return null;
  ref.read(placeListsProvider.notifier).create(name);
  return name.trim();
}
