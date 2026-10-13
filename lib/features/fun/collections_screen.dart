import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../explore/explore_screen.dart' show PlaceTile, OsmCredit;

/// Smart collections made from real map tags (Wi-Fi, opening hours,
/// wheelchair access…). A place is only in one when the map says so.
class CollectionsScreen extends ConsumerWidget {
  const CollectionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final all = ref.watch(allPlacesProvider);
    return Scaffold(
      appBar: AppBar(title: Text(trf('Collections in {city}', {'city': tr(Cities.all[city] ?? city)}))),
      body: AsyncView(
        value: all,
        onRetry: () => ref.invalidate(allPlacesProvider),
        builder: (places) {
          final rows = [for (final c in smartCollections) (c, collectionPlaces(c, places, city).length)]
              .where((r) => r.$2 > 0)
              .toList();
          if (rows.isEmpty) {
            return EmptyState(emoji: '🗂️', title: tr('No collections here yet'), message: tr('Try another city.'));
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              Text(
                tr('Made from what the map says about each place. Unknown means not included.'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: KSpace.sm),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: KSpace.sm,
                crossAxisSpacing: KSpace.sm,
                childAspectRatio: 1.35,
                children: [
                  for (final (c, n) in rows)
                    Card(
                      margin: EdgeInsets.zero,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(KRadius.card),
                        onTap: () => context.push('/collection/${c.key}'),
                        child: Padding(
                          padding: const EdgeInsets.all(KSpace.sm),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(c.emoji, style: const TextStyle(fontSize: 28)),
                              const Spacer(),
                              Text(
                                c.title,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.titleSmall,
                              ),
                              Text(trf('{n} places', {'n': n}), style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const OsmCredit(),
            ],
          );
        },
      ),
    );
  }
}

class CollectionScreen extends ConsumerWidget {
  const CollectionScreen({super.key, required this.collectionKey});

  final String collectionKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = smartCollections.where((c) => c.key == collectionKey).firstOrNull;
    final city = ref.watch(cityProvider);
    final here = ref.watch(myLocationProvider);
    if (c == null) {
      return Scaffold(
        appBar: AppBar(),
        body: EmptyState(emoji: '🗂️', title: tr('This collection is gone')),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text('${c.emoji} ${c.title}')),
      body: AsyncView(
        value: ref.watch(allPlacesProvider),
        onRetry: () => ref.invalidate(allPlacesProvider),
        builder: (all) {
          final places = collectionPlaces(c, all, city).take(200).toList();
          return ListView(
            padding: const EdgeInsets.only(bottom: KSpace.xl),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                child: Text(
                  '${c.hint} · ${trf('{n} places', {'n': places.length})}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              if (places.isEmpty)
                EmptyState(emoji: '🗂️', title: tr('Nothing here in this city'), message: tr('Try another city.'))
              else
                for (final p in places) PlaceTile(place: p, from: here),
              const OsmCredit(),
            ],
          );
        },
      ),
    );
  }
}
