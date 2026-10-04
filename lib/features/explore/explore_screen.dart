import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart' show haversineKm;
import '../../widgets/common.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  String _query = '';
  String? _category;
  bool _openNow = false;
  (double, double)? _me; // set when "Near me" is on
  bool _locating = false;

  Future<void> _toggleNearMe() async {
    if (_me != null) {
      setState(() => _me = null);
      return;
    }
    setState(() => _locating = true);
    try {
      final here = await ref.read(locationServiceProvider).current();
      if (mounted) setState(() => _me = here);
    } catch (e) {
      if (mounted) showError(context, e);
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  List<Place> _filter(List<Place> all) {
    final raw = _query.trim();
    final q = raw.toLowerCase();
    final now = DateTime.now();
    final list = all.where((p) {
      // Shops live inside malls; show them only when asked for.
      if (_category == null && p.category == 'shop' && q.isEmpty) return false;
      if (_category != null && p.category != _category) return false;
      if (_openNow && p.isOpenAt(now) != true) return false;
      if (q.isEmpty) return true;
      return p.name.toLowerCase().contains(q) ||
          (p.nameAr?.contains(raw) ?? false) ||
          (p.area?.toLowerCase().contains(q) ?? false) ||
          (p.cuisine?.toLowerCase().contains(q) ?? false) ||
          (p.kind?.toLowerCase().contains(q) ?? false) ||
          Categories.label(p.category).toLowerCase().contains(q);
    }).toList();
    final me = _me;
    if (me != null) {
      list.removeWhere((p) => !p.hasLocation);
      list.sort((a, b) => haversineKm(me.$1, me.$2, a.lat!, a.lng!)
          .compareTo(haversineKm(me.$1, me.$2, b.lat!, b.lng!)));
    }
    return list;
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
                hintText: 'Search places, food, areas…',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.sm),
              children: [
                FilterChip(
                  avatar: _locating
                      ? const SizedBox(
                          width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.near_me_outlined, size: 18),
                  label: const Text('Near me'),
                  selected: _me != null,
                  showCheckmark: false,
                  onSelected: _locating ? null : (_) => _toggleNearMe(),
                ),
                const SizedBox(width: KSpace.sm),
                FilterChip(
                  avatar: const Icon(Icons.schedule, size: 18),
                  label: const Text('Open now'),
                  selected: _openNow,
                  showCheckmark: false,
                  onSelected: (v) => setState(() => _openNow = v),
                ),
                const SizedBox(width: KSpace.sm),
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
                  return EmptyState(
                    emoji: '🔍',
                    title: 'Nothing matches',
                    message: _openNow
                        ? 'Only places with known opening hours show under "Open now".'
                        : null,
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
                  itemCount: list.length + 1,
                  separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
                  itemBuilder: (_, i) => i == list.length
                      ? const OsmCredit()
                      : PlaceTile(place: list[i], from: _me),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// "Open now" / "Closed now" badge, only when the hours are known.
class OpenBadge extends StatelessWidget {
  const OpenBadge({super.key, required this.place});

  final Place place;

  @override
  Widget build(BuildContext context) {
    final open = place.isOpenAt(DateTime.now());
    if (open == null) return const SizedBox.shrink();
    final color = open ? const Color(0xFF2EAD6B) : Theme.of(context).colorScheme.error;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 4),
        Text(open ? 'Open now' : 'Closed now',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }
}

class PlaceTile extends StatelessWidget {
  const PlaceTile({super.key, required this.place, this.from});

  final Place place;

  /// When set, shows the distance from this point.
  final (double, double)? from;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final km = from != null && place.hasLocation
        ? haversineKm(from!.$1, from!.$2, place.lat!, place.lng!)
        : null;
    final sub = [
      if (km != null) km < 1 ? '${(km * 1000).round()} m' : '${km.toStringAsFixed(1)} km',
      place.kindLabel ?? Categories.label(place.category),
      if (place.details.floorLabel != null) place.details.floorLabel!,
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
                url: place.photoUrl,
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
                        style: text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(sub, style: text.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    OpenBadge(place: place),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: context.k.inkMuted),
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
        'Place data © OpenStreetMap contributors (openstreetmap.org/copyright).\n'
        'Photos from Wikimedia Commons.',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}
