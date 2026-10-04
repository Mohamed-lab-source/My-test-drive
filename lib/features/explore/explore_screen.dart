import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  String _query = '';
  String? _category;

  List<Place> _filter(List<Place> all) {
    final q = _query.trim().toLowerCase();
    return all.where((p) {
      if (_category != null && p.category != _category) return false;
      if (q.isEmpty) return true;
      return p.name.toLowerCase().contains(q) ||
          (p.area?.toLowerCase().contains(q) ?? false) ||
          Categories.label(p.category).toLowerCase().contains(q);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final city = ref.watch(cityProvider);
    final places = ref.watch(placesInCityProvider(city));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore'),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'City',
            initialValue: city,
            onSelected: (c) => ref.read(cityProvider.notifier).set(c),
            itemBuilder: (_) => [
              for (final e in Cities.all.entries)
                PopupMenuItem(value: e.key, child: Text(e.value)),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
              child: Row(
                children: [
                  Text(Cities.all[city] ?? city,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const Icon(Icons.expand_more),
                ],
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'Search places or areas',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(
                  horizontal: KSpace.md, vertical: KSpace.sm),
              children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: _category == null,
                  showCheckmark: false,
                  onSelected: (_) => setState(() => _category = null),
                ),
                for (final e in Categories.all.entries) ...[
                  const SizedBox(width: KSpace.sm),
                  ChoiceChip(
                    label: Text('${Categories.emoji(e.key)} ${e.value}'),
                    selected: _category == e.key,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _category = e.key),
                  ),
                ],
              ],
            ),
          ),
          Expanded(
            child: AsyncView<List<Place>>(
              value: places,
              onRetry: () => ref.invalidate(placesInCityProvider(city)),
              builder: (all) {
                if (all.isEmpty) {
                  return const EmptyState(
                    emoji: '🗺️',
                    title: 'No places here yet',
                    message: "We're still adding real places for this city.",
                  );
                }
                final list = _filter(all);
                if (list.isEmpty) {
                  return const EmptyState(
                      emoji: '🔍', title: 'Nothing matches that search');
                }
                return RefreshIndicator(
                  onRefresh: () =>
                      ref.refresh(placesInCityProvider(city).future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(
                        KSpace.md, 0, KSpace.md, KSpace.xl),
                    itemCount: list.length + 1,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: KSpace.sm),
                    itemBuilder: (_, i) => i == list.length
                        ? const OsmCredit()
                        : PlaceTile(place: list[i]),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class PlaceTile extends StatelessWidget {
  const PlaceTile({super.key, required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final sub = [
      Categories.label(place.category),
      if (place.area != null) place.area!,
      if (place.cuisineLabel != null) place.cuisineLabel!,
    ].join(' · ');
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/place/${place.id}'),
        child: Padding(
          padding: const EdgeInsets.all(KSpace.sm + 4),
          child: Row(
            children: [
              PlaceImage(
                url: null,
                emoji: Categories.emoji(place.category),
                width: 64,
                height: 64,
              ),
              const SizedBox(width: KSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(place.name,
                        style: text.titleMedium,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(sub,
                        style: text.bodySmall,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, color: KColors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

/// OpenStreetMap's data licence asks us to credit its contributors.
class OsmCredit extends StatelessWidget {
  const OsmCredit({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: KSpace.md),
      child: Text(
        'Place data © OpenStreetMap contributors (openstreetmap.org/copyright)',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}
