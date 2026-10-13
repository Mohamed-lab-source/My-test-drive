import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/review.dart';
import '../../widgets/common.dart';
import 'review_screens.dart' show starsText;

final _topProvider = FutureProvider.autoDispose<List<(String, PlaceStats)>>(
    (ref) => ref.watch(reviewsRepositoryProvider).mostReviewed());
final _freshProvider =
    FutureProvider.autoDispose<List<Review>>((ref) => ref.watch(reviewsRepositoryProvider).newest());

/// What Khroga users love: top-rated places (by real reviews) in your city,
/// and the newest reviews. Read once when opened.
class CommunityScreen extends ConsumerWidget {
  const CommunityScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: Text(tr('Khroga community')),
          bottom: TabBar(tabs: [Tab(text: tr('Top rated')), Tab(text: tr('Fresh reviews'))]),
        ),
        body: const TabBarView(children: [_TopTab(), _FreshTab()]),
      ),
    );
  }
}

class _TopTab extends ConsumerWidget {
  const _TopTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final places = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final byId = {for (final p in places) p.id: p};
    return RefreshIndicator(
      onRefresh: () => ref.refresh(_topProvider.future),
      child: AsyncView(
        value: ref.watch(_topProvider),
        onRetry: () => ref.invalidate(_topProvider),
        builder: (list) {
          final rows = [
            for (final (id, s) in list)
              if (byId[id] case final p? when p.city == city && s.count >= 1) (p, s),
          ]..sort((a, b) {
              // Best average first, but a place needs a few reviews to lead.
              double score(PlaceStats s) => (s.sum + 3 * 3) / (s.count + 3);
              return score(b.$2).compareTo(score(a.$2));
            });
          if (rows.isEmpty) {
            return ListView(children: [
              EmptyState(
                emoji: '⭐',
                title: tr('No ratings in this city yet'),
                message: tr('Review places you\'ve been to and they\'ll show up here for everyone.'),
              ),
            ]);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(KSpace.md),
            itemCount: rows.length,
            itemBuilder: (_, i) {
              final (p, s) = rows[i];
              return Card(
                child: ListTile(
                  leading: CircleAvatar(child: Text('${i + 1}')),
                  title: Text(p.shownName, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text([
                    '${Categories.emoji(p.category)} ${p.kindLabel ?? Categories.label(p.category)}',
                    ?p.area,
                  ].join(' · ')),
                  trailing: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text('★ ${s.average!.toStringAsFixed(1)}',
                        style: TextStyle(color: context.k.accent, fontWeight: FontWeight.w800)),
                    Text(trf('{n} reviews', {'n': s.count}), style: Theme.of(context).textTheme.labelSmall),
                  ]),
                  onTap: () => context.push('/place/${p.id}'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _FreshTab extends ConsumerWidget {
  const _FreshTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final places = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final byId = {for (final p in places) p.id: p};
    final blocked = ref.watch(blockedUsersProvider);
    return RefreshIndicator(
      onRefresh: () => ref.refresh(_freshProvider.future),
      child: AsyncView(
        value: ref.watch(_freshProvider),
        onRetry: () => ref.invalidate(_freshProvider),
        builder: (list) {
          final rows = list.where((r) => !blocked.containsKey(r.uid) && byId.containsKey(r.placeId)).toList();
          if (rows.isEmpty) {
            return ListView(children: [EmptyState(emoji: '✍️', title: tr('No reviews yet'))]);
          }
          return ListView.builder(
            padding: const EdgeInsets.all(KSpace.md),
            itemCount: rows.length,
            itemBuilder: (_, i) {
              final r = rows[i];
              final p = byId[r.placeId]!;
              return Card(
                child: ListTile(
                  leading: Text(Categories.emoji(p.category), style: const TextStyle(fontSize: 26)),
                  title: Text(p.shownName, maxLines: 1, overflow: TextOverflow.ellipsis),
                  subtitle: Text(
                    [
                      '${starsText(r.stars)}  ${r.name}',
                      if (r.text.isNotEmpty) r.text,
                    ].join('\n'),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  isThreeLine: r.text.isNotEmpty,
                  onTap: () => context.push('/place/${p.id}'),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
