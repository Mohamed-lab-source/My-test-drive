import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/helpers.dart' show normalizeSearch, timeAgo;
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';

/// Your 100 newest notes, read once (not a live listener) to save reads.
final myNotesProvider =
    FutureProvider.autoDispose<List<({String placeId, String text, DateTime? updatedAt})>>((ref) {
  final uid = ref.watch(uidProvider);
  if (uid == null) return Future.value(const []);
  return ref.watch(personalRepositoryProvider).allNotes(uid);
});

/// All your private notes on places, in one place.
class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final notes = ref.watch(myNotesProvider);
    final places = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final byId = {for (final p in places) p.id: p};
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: Text(tr('My notes'))),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(myNotesProvider.future),
        child: AsyncView(
          value: notes,
          onRetry: () => ref.invalidate(myNotesProvider),
          builder: (list) {
            if (list.isEmpty) {
              return ListView(children: [
                EmptyState(
                  emoji: '📝',
                  title: tr('No notes yet'),
                  message: tr('Open any place and write a private note. Only you can see it.'),
                ),
              ]);
            }
            final shown = list.where((n) {
              if (_q.isEmpty) return true;
              final p = byId[n.placeId];
              return normalizeSearch('${n.text} ${p?.name ?? ''} ${p?.nameAr ?? ''}').contains(_q);
            }).toList();
            return ListView(
              padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
              children: [
                TextField(
                  decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search), hintText: tr('Search my notes')),
                  onChanged: (v) => setState(() => _q = normalizeSearch(v)),
                ),
                const SizedBox(height: KSpace.sm),
                Text(trf('{n} notes', {'n': list.length}), style: Theme.of(context).textTheme.bodySmall),
                for (final n in shown)
                  Card(
                    child: ListTile(
                      leading: Text(Categories.emoji(byId[n.placeId]?.category ?? ''),
                          style: const TextStyle(fontSize: 24)),
                      title: Text(byId[n.placeId]?.shownName ?? tr('A place no longer on the map')),
                      subtitle: Text(
                        [n.text, if (n.updatedAt != null) timeAgo(n.updatedAt!, now)].join('\n'),
                        maxLines: 4,
                        overflow: TextOverflow.ellipsis,
                      ),
                      isThreeLine: true,
                      onTap: byId[n.placeId] == null ? null : () => context.push('/place/${n.placeId}'),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
