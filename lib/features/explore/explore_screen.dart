import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/local_history.dart';
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

enum _Sort { best, nearest, az }

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _search = TextEditingController();
  String _query = '';
  String? _category;
  String? _area;
  String? _kind; // food type / place type within a category
  bool _openNow = false;
  _Sort _sort = _Sort.best;
  bool _locating = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<bool> _ensureLocation() async {
    if (ref.read(myLocationProvider) != null) return true;
    setState(() => _locating = true);
    try {
      final here = await ref.read(locationServiceProvider).current();
      ref.read(myLocationProvider.notifier).set(here);
      return true;
    } catch (e) {
      if (mounted) showError(context, e);
      return false;
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _setSort(_Sort sort) async {
    if (sort == _Sort.nearest && !await _ensureLocation()) return;
    setState(() => _sort = sort);
  }

  void _useQuery(String q) {
    _search.text = q;
    _search.selection = TextSelection.collapsed(offset: q.length);
    setState(() => _query = q);
  }

  /// Words a person might filter by inside a category (cuisine or type).
  static List<String> kindsOf(Place p) => [
        ...?p.cuisine?.split(';').map((c) => c.trim().replaceAll('_', ' ')),
        ?p.kindLabel,
      ].where((k) => k.isNotEmpty && k != 'shisha').toList();

  List<Place> _filter(List<Place> all, (double, double)? me) {
    final raw = _query.trim();
    final q = raw.toLowerCase();
    final now = DateTime.now();
    final list = all.where((p) {
      // Shops live inside malls; show them only when asked for.
      if (_category == null && p.category == 'shop' && q.isEmpty) return false;
      if (_category != null && p.category != _category) return false;
      if (_area != null && p.area != _area) return false;
      if (_kind != null && !kindsOf(p).contains(_kind)) return false;
      if (_openNow && p.isOpenAt(now) != true) return false;
      if (q.isEmpty) return true;
      return p.name.toLowerCase().contains(q) ||
          (p.nameAr?.contains(raw) ?? false) ||
          (p.area?.toLowerCase().contains(q) ?? false) ||
          (p.cuisine?.toLowerCase().contains(q) ?? false) ||
          (p.kind?.toLowerCase().contains(q) ?? false) ||
          Categories.label(p.category).toLowerCase().contains(q);
    }).toList();
    switch (_sort) {
      case _Sort.nearest when me != null:
        list.removeWhere((p) => !p.hasLocation);
        list.sort((a, b) => haversineKm(me.$1, me.$2, a.lat!, a.lng!)
            .compareTo(haversineKm(me.$1, me.$2, b.lat!, b.lng!)));
      case _Sort.az:
        list.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      default:
        break; // already best-documented first
    }
    return list;
  }

  /// The most common values in a list, for filter choices.
  static List<String> _top(Iterable<String> values, int n) {
    final counts = <String, int>{};
    for (final v in values) {
      counts[v] = (counts[v] ?? 0) + 1;
    }
    final keys = counts.keys.where((k) => counts[k]! >= 2).toList()
      ..sort((a, b) => counts[b]!.compareTo(counts[a]!));
    return keys.take(n).toList();
  }

  void _surprise(List<Place> list) {
    final good = list.where((p) => p.category != 'shop').toList();
    if (good.isEmpty) return;
    // Pick from the better-documented half so the surprise is a good one.
    final pool = good.take((good.length / 2).ceil().clamp(1, 300)).toList()..shuffle();
    context.push('/place/${pool.first.id}');
  }

  Future<void> _pickArea(List<Place> all) async {
    final areas = _top(all.map((p) => p.area).whereType<String>(), 60)..sort();
    final picked = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (_, controller) => ListView(
          controller: controller,
          children: [
            ListTile(
              title: const Text('Any area', style: TextStyle(fontWeight: FontWeight.w700)),
              onTap: () => Navigator.pop(sheetContext, ''),
            ),
            for (final a in areas)
              ListTile(title: Text(a), onTap: () => Navigator.pop(sheetContext, a)),
          ],
        ),
      ),
    );
    if (picked != null) setState(() => _area = picked.isEmpty ? null : picked);
  }

  @override
  Widget build(BuildContext context) {
    final city = ref.watch(cityProvider);
    final places = ref.watch(placesInCityProvider(city));
    final me = ref.watch(myLocationProvider);
    final history = ref.watch(searchHistoryProvider);
    final recentIds = ref.watch(recentPlacesProvider);
    final allPlaces = ref.watch(allPlacesProvider).value ?? const <Place>[];
    final recent = [
      for (final id in recentIds.take(10)) ?allPlaces.where((p) => p.id == id).firstOrNull,
    ];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore'),
        actions: [
          IconButton(
            tooltip: 'Surprise me',
            icon: const Text('🎲', style: TextStyle(fontSize: 22)),
            onPressed: () => places.whenData((all) => _surprise(_filter(all, me))),
          ),
          PopupMenuButton<String>(
            tooltip: 'City',
            initialValue: city,
            onSelected: (c) {
              ref.read(cityProvider.notifier).set(c);
              setState(() => _area = null);
            },
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
      body: AsyncView<List<Place>>(
        value: places,
        onRetry: () => ref.invalidate(placesInCityProvider(city)),
        builder: (all) {
          final inCategory = _category == null ? all : all.where((p) => p.category == _category).toList();
          final kinds = _category == null ? const <String>[] : _top(inCategory.expand(kindsOf), 15);
          final list = _filter(all, me);
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: 'Search places, food, areas…',
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _query.isEmpty
                          ? null
                          : IconButton(
                              tooltip: 'Clear',
                              icon: const Icon(Icons.close),
                              onPressed: () => _useQuery(''),
                            ),
                    ),
                    onChanged: (v) => setState(() => _query = v),
                    onSubmitted: (v) => ref.read(searchHistoryProvider.notifier).add(v),
                  ),
                ),
              ),
              if (_query.isEmpty && history.isNotEmpty)
                SliverToBoxAdapter(
                  child: _ChipRow(children: [
                    for (final h in history)
                      ActionChip(
                        avatar: const Icon(Icons.history, size: 16),
                        label: Text(h),
                        onPressed: () => _useQuery(h),
                      ),
                    ActionChip(
                      label: const Text('Clear'),
                      onPressed: () => ref.read(searchHistoryProvider.notifier).clear(),
                    ),
                  ]),
                ),
              SliverToBoxAdapter(
                child: _ChipRow(children: [
                  PopupMenuButton<_Sort>(
                    tooltip: 'Sort',
                    onSelected: _setSort,
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: _Sort.best, child: Text('Best match')),
                      PopupMenuItem(value: _Sort.nearest, child: Text('Nearest to me')),
                      PopupMenuItem(value: _Sort.az, child: Text('A–Z')),
                    ],
                    child: Chip(
                      avatar: _locating
                          ? const SizedBox(
                              width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.sort, size: 18),
                      label: Text(switch (_sort) {
                        _Sort.best => 'Best match',
                        _Sort.nearest => 'Nearest',
                        _Sort.az => 'A–Z',
                      }),
                    ),
                  ),
                  FilterChip(
                    avatar: const Icon(Icons.schedule, size: 18),
                    label: const Text('Open now'),
                    selected: _openNow,
                    showCheckmark: false,
                    onSelected: (v) => setState(() => _openNow = v),
                  ),
                  FilterChip(
                    avatar: const Icon(Icons.location_city, size: 18),
                    label: Text(_area ?? 'Any area'),
                    selected: _area != null,
                    showCheckmark: false,
                    onSelected: (_) => _pickArea(all),
                  ),
                ]),
              ),
              SliverToBoxAdapter(
                child: _ChipRow(children: [
                  ChoiceChip(
                    label: const Text('All'),
                    selected: _category == null,
                    showCheckmark: false,
                    onSelected: (_) => setState(() {
                      _category = null;
                      _kind = null;
                    }),
                  ),
                  for (final e in Categories.all.entries)
                    ChoiceChip(
                      label: Text('${Categories.emoji(e.key)} ${e.value}'),
                      selected: _category == e.key,
                      showCheckmark: false,
                      onSelected: (_) => setState(() {
                        _category = e.key;
                        _kind = null;
                      }),
                    ),
                ]),
              ),
              if (kinds.isNotEmpty)
                SliverToBoxAdapter(
                  child: _ChipRow(children: [
                    for (final k in kinds)
                      FilterChip(
                        label: Text(k),
                        selected: _kind == k,
                        showCheckmark: false,
                        onSelected: (on) => setState(() => _kind = on ? k : null),
                      ),
                  ]),
                ),
              if (recent.isNotEmpty && _query.isEmpty && _category == null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                    child: SectionTitle('Recently viewed',
                        trailing: TextButton(
                          onPressed: () => ref.read(recentPlacesProvider.notifier).clear(),
                          child: const Text('Clear'),
                        )),
                  ),
                ),
              if (recent.isNotEmpty && _query.isEmpty && _category == null)
                SliverToBoxAdapter(
                  child: SizedBox(
                    height: 44,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                      children: [
                        for (final p in recent)
                          Padding(
                            padding: const EdgeInsets.only(right: KSpace.sm),
                            child: ActionChip(
                              avatar: Text(Categories.emoji(p.category)),
                              label: Text(p.name, overflow: TextOverflow.ellipsis),
                              onPressed: () => context.push('/place/${p.id}'),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.sm, KSpace.md, KSpace.sm),
                  child: Text('${list.length} places', style: Theme.of(context).textTheme.bodySmall),
                ),
              ),
              if (all.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    emoji: '🗺️',
                    title: 'No places here yet',
                    message: "We're still adding real places for this city.",
                  ),
                )
              else if (list.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    emoji: '🔍',
                    title: 'Nothing matches',
                    message: _openNow
                        ? 'Only places with known opening hours show under "Open now".'
                        : null,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
                  sliver: SliverList.separated(
                    itemCount: list.length + 1,
                    separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
                    itemBuilder: (_, i) => i == list.length
                        ? const OsmCredit()
                        : PlaceTile(place: list[i], from: _sort == _Sort.nearest ? me : null),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// A horizontally scrolling row of chips.
class _ChipRow extends StatelessWidget {
  const _ChipRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: 6),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(width: KSpace.sm),
        itemBuilder: (_, i) => children[i],
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
        'Places: © OpenStreetMap contributors (openstreetmap.org/copyright) '
        'and Overture Maps Foundation.\nPhotos from Wikimedia Commons.',
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}
