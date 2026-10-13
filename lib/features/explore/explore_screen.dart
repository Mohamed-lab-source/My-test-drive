import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart' show fuzzyContains, latinDigits;
import '../../app/helpers.dart' show normalizeSearch;
import '../../app/local_history.dart';
import '../../app/local_prefs.dart';
import 'package:share_plus/share_plus.dart';
import 'place_details_screen.dart' show placeShareText;
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../planner/planner.dart' show haversineKm;
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

enum _Sort { best, nearest, az }

/// Extra filters, each based on a real map fact (unknown = not shown).
enum _Extra {
  nearMe('📍 Within 2 km'),
  openLate('🌙 Open late'),
  wheelchair('♿ Wheelchair'),
  wifi('📶 Wi-Fi'),
  outdoor('🌤️ Outdoor seating'),
  photo('📷 Has photo'),
  website('🌐 Has website'),
  phone('📞 Has phone number'),
  allDay('🕛 Open 24 hours'),
  vegetarian('🥗 Vegetarian'),
  delivery('🛵 Delivery'),
  cards('💳 Cards'),
  noSmoking('🚭 No smoking'),
  shisha('💨 Shisha'),
  ac('❄️ Air conditioned'),
  notVisited("🆕 Haven't been"),
  favorites('❤️ My favorites');

  const _Extra(this.label);
  final String label;
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  final _search = TextEditingController();
  bool _closeMatches = false;
  String _query = '';
  String? _category;
  String? _area;
  String? _kind; // food type / place type within a category
  bool _openNow = false;
  _Sort _sort = _Sort.best;
  bool _locating = false;
  bool _grid = false;
  bool _map = false;
  final Set<_Extra> _extras = {};
  Set<String> _visited = const {};
  Set<String> _favorites = const {};
  final _scroll = ScrollController();
  bool _showTop = false;

  @override
  void initState() {
    super.initState();
    // Remember the last category and sort (on this phone).
    final mem = ref.read(exploreMemoryProvider);
    final cat = mem['category'];
    if (cat != null && Categories.all.containsKey(cat)) _category = cat;
    if (mem['sort'] == 'az') _sort = _Sort.az;
    _scroll.addListener(() {
      final show = _scroll.offset > 1200;
      if (show != _showTop) setState(() => _showTop = show);
    });
  }

  void _remember() {
    final mem = ref.read(exploreMemoryProvider.notifier);
    mem.set('category', _category);
    mem.set('sort', _sort == _Sort.az ? 'az' : null);
  }

  bool get _anyFilter =>
      _query.isNotEmpty || _category != null || _area != null || _kind != null || _openNow || _extras.isNotEmpty;

  void _clearFilters() {
    _search.clear();
    setState(() {
      _query = '';
      _category = null;
      _area = null;
      _kind = null;
      _openNow = false;
      _extras.clear();
    });
  }

  @override
  void dispose() {
    _search.dispose();
    _scroll.dispose();
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
    _remember();
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
    final q = normalizeSearch(latinDigits(raw));
    final now = DateTime.now();
    bool passes(Place p) {
      // Shops live inside malls; show them only when asked for.
      if (_category == null && p.category == 'shop' && q.isEmpty) return false;
      if (_category != null && p.category != _category) return false;
      if (_area != null && p.area != _area) return false;
      if (_kind != null && !kindsOf(p).contains(_kind)) return false;
      if (_openNow && p.isOpenAt(now) != true) return false;
      if (_extras.isNotEmpty && !_passesExtras(p, me, now)) return false;
      return true;
    }

    bool matches(Place p) {
      bool has(String? s) => s != null && normalizeSearch(s).contains(q);
      return has(p.name) ||
          has(p.nameAr) ||
          has(p.area) ||
          has(p.cuisine?.replaceAll('_', ' ')) ||
          has(p.cuisineLabel) ||
          has(p.kind?.replaceAll('_', ' ')) ||
          has(p.kindLabel) ||
          has(p.details.brand) ||
          has(Categories.label(p.category));
    }

    final list = all.where((p) => passes(p) && (q.isEmpty || matches(p))).toList();
    // Nothing found? Allow one typo per longer word ("zamalk" → Zamalek).
    _closeMatches = false;
    if (list.isEmpty && q.length >= 4) {
      list.addAll(all
          .where((p) =>
              passes(p) &&
              fuzzyContains(normalizeSearch('${p.name} ${p.nameAr ?? ''} ${p.area ?? ''}'), q))
          .take(200));
      _closeMatches = list.isNotEmpty;
    }
    switch (_sort) {
      case _Sort.nearest when me != null:
        list.removeWhere((p) => !p.hasLocation);
        list.sort((a, b) => haversineKm(me.$1, me.$2, a.lat!, a.lng!)
            .compareTo(haversineKm(me.$1, me.$2, b.lat!, b.lng!)));
      case _Sort.az:
        list.sort((a, b) => a.shownName.toLowerCase().compareTo(b.shownName.toLowerCase()));
      default:
        break; // already best-documented first
    }
    return list;
  }

  bool _passesExtras(Place p, (double, double)? me, DateTime now) {
    for (final e in _extras) {
      final ok = switch (e) {
        _Extra.nearMe => me != null &&
            p.hasLocation &&
            haversineKm(me.$1, me.$2, p.lat!, p.lng!) <= 2,
        _Extra.openLate =>
          p.isOpenAt(DateTime(now.year, now.month, now.day, 23, 30)) == true,
        _Extra.wheelchair => p.details.wheelchair == 'yes' || p.details.wheelchair == 'limited',
        _Extra.wifi => p.details.wifi == true,
        _Extra.outdoor => p.details.outdoorSeating == true,
        _Extra.photo => p.photoUrl != null,
        _Extra.website => p.website != null,
        _Extra.phone => p.phone != null,
        _Extra.allDay => p.openingHours?.trim() == '24/7',
        _Extra.vegetarian => p.details.vegetarian != null && p.details.vegetarian != 'no',
        _Extra.delivery => p.details.delivery == true,
        _Extra.cards => p.details.cards == true,
        _Extra.noSmoking => p.details.smoking == 'no',
        _Extra.shisha => p.details.shisha == true,
        _Extra.ac => p.details.airConditioning == true,
        _Extra.notVisited => !_visited.contains(p.id),
        _Extra.favorites => _favorites.contains(p.id),
      };
      if (!ok) return false;
    }
    return true;
  }

  Future<void> _toggleExtra(_Extra e, bool on) async {
    if (on && e == _Extra.nearMe && !await _ensureLocation()) return;
    setState(() => on ? _extras.add(e) : _extras.remove(e));
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

  /// How many of these places are known to be open right now.
  static int _openCount(List<Place> list) {
    final now = DateTime.now();
    return list.take(3000).where((p) => p.isOpenAt(now) == true).length;
  }

  void _surprise(List<Place> list) {
    final good = list.where((p) => p.category != 'shop').toList();
    if (good.isEmpty) return;
    // Pick from the better-documented half so the surprise is a good one.
    final pool = good.take((good.length / 2).ceil().clamp(1, 300)).toList()..shuffle();
    context.push('/place/${pool.first.id}');
  }

  Future<void> _pickArea(List<Place> all) async {
    final counts = <String, int>{};
    for (final p in all) {
      if (p.area != null && p.category != 'shop') counts[p.area!] = (counts[p.area!] ?? 0) + 1;
    }
    final areas = counts.keys.where((a) => counts[a]! >= 2).toList()..sort();
    final picked = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      builder: (sheetContext) => _AreaSheet(areas: areas, counts: counts),
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
    _visited = (ref.watch(visitedIdsProvider).value ?? const <String>[]).toSet();
    _favorites = (ref.watch(favoriteIdsProvider).value ?? const <String>[]).toSet();
    final recent = [
      for (final id in recentIds.take(10)) ?allPlaces.where((p) => p.id == id).firstOrNull,
    ];

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Explore')),
        actions: [
          IconButton(
            tooltip: tr('All malls'),
            icon: const Text('🛍️', style: TextStyle(fontSize: 20)),
            onPressed: () => context.push('/malls'),
          ),
          IconButton(
            tooltip: _map ? tr('List') : tr('Map'),
            icon: Icon(_map ? Icons.view_list_outlined : Icons.map_outlined),
            onPressed: () => setState(() => _map = !_map),
          ),
          if (!_map)
          IconButton(
            tooltip: _grid ? tr('List view') : tr('Photo grid'),
            icon: Icon(_grid ? Icons.view_list_outlined : Icons.grid_view_outlined),
            onPressed: () => setState(() => _grid = !_grid),
          ),
          IconButton(
            tooltip: tr('Surprise me'),
            icon: const Text('🎲', style: TextStyle(fontSize: 22)),
            onPressed: () => places.whenData((all) => _surprise(_filter(all, me))),
          ),
          PopupMenuButton<String>(
            tooltip: tr('City'),
            initialValue: city,
            onSelected: (c) {
              ref.read(cityProvider.notifier).set(c);
              setState(() => _area = null);
            },
            itemBuilder: (_) => [
              for (final e in Cities.all.entries)
                PopupMenuItem(value: e.key, child: Text(tr(e.value))),
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
          final catCounts = <String, int>{};
          for (final p in all) {
            catCounts[p.category] = (catCounts[p.category] ?? 0) + 1;
          }
          final popularAreas = _area != null || _query.isNotEmpty ? const <String>[] : _top(
              (_category == null ? all.where((p) => p.category != 'shop') : inCategory)
                  .map((p) => p.area)
                  .whereType<String>(),
              6);
          return Stack(children: [CustomScrollView(
            controller: _scroll,
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                  child: TextField(
                    controller: _search,
                    textInputAction: TextInputAction.search,
                    decoration: InputDecoration(
                      hintText: tr('Search places, food, areas…'),
                      prefixIcon: const Icon(Icons.search),
                      suffixIcon: _query.isEmpty
                          ? null
                          : IconButton(
                              tooltip: tr('Clear'),
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
                      label: Text(tr('Clear')),
                      onPressed: () => ref.read(searchHistoryProvider.notifier).clear(),
                    ),
                  ]),
                ),
              SliverToBoxAdapter(
                child: _ChipRow(children: [
                  if (_anyFilter)
                    ActionChip(
                      avatar: const Icon(Icons.filter_alt_off_outlined, size: 18),
                      label: Text(tr('Clear filters')),
                      onPressed: _clearFilters,
                    ),
                  ActionChip(
                    avatar: const Text('📋'),
                    label: Text(tr('My lists')),
                    onPressed: () => context.push('/lists'),
                  ),
                  ActionChip(
                    avatar: const Text('⭐'),
                    label: Text(tr('Top on Khroga')),
                    onPressed: () => context.push('/community'),
                  ),
                  ActionChip(
                    avatar: const Text('🏘️'),
                    label: Text(tr('Areas')),
                    onPressed: () => context.push('/areas'),
                  ),
                  ActionChip(
                    avatar: const Text('💡'),
                    label: Text(tr('Ideas')),
                    onPressed: () => context.push('/ideas'),
                  ),
                  PopupMenuButton<_Sort>(
                    tooltip: tr('Sort'),
                    onSelected: _setSort,
                    itemBuilder: (_) => [
                      PopupMenuItem(value: _Sort.best, child: Text(tr('Best match'))),
                      PopupMenuItem(value: _Sort.nearest, child: Text(tr('Nearest to me'))),
                      PopupMenuItem(value: _Sort.az, child: Text(tr('A–Z'))),
                    ],
                    child: Chip(
                      avatar: _locating
                          ? const SizedBox(
                              width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.sort, size: 18),
                      label: Text(switch (_sort) {
                        _Sort.best => tr('Best match'),
                        _Sort.nearest => tr('Nearest'),
                        _Sort.az => tr('A–Z'),
                      }),
                    ),
                  ),
                  FilterChip(
                    avatar: const Icon(Icons.schedule, size: 18),
                    label: Text(tr('Open now')),
                    selected: _openNow,
                    showCheckmark: false,
                    onSelected: (v) => setState(() => _openNow = v),
                  ),
                  FilterChip(
                    avatar: const Icon(Icons.location_city, size: 18),
                    label: Text(_area ?? tr('Any area')),
                    selected: _area != null,
                    showCheckmark: false,
                    onSelected: (_) => _pickArea(all),
                  ),
                  for (final e in _Extra.values)
                    FilterChip(
                      label: Text(tr(e.label)),
                      selected: _extras.contains(e),
                      showCheckmark: false,
                      onSelected: (on) => _toggleExtra(e, on),
                    ),
                ]),
              ),
              SliverToBoxAdapter(
                child: _ChipRow(children: [
                  ChoiceChip(
                    label: Text(tr('All')),
                    selected: _category == null,
                    showCheckmark: false,
                    onSelected: (_) {
                      setState(() {
                        _category = null;
                        _kind = null;
                      });
                      _remember();
                    },
                  ),
                  for (final e in Categories.all.entries)
                    ChoiceChip(
                      label: Text('${Categories.emoji(e.key)} ${Categories.label(e.key)} · ${catCounts[e.key] ?? 0}'),
                      selected: _category == e.key,
                      showCheckmark: false,
                      onSelected: (_) {
                        setState(() {
                          _category = e.key;
                          _kind = null;
                        });
                        _remember();
                      },
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
              if (popularAreas.length >= 3)
                SliverToBoxAdapter(
                  child: _ChipRow(children: [
                    for (final a in popularAreas)
                      ActionChip(
                        avatar: const Icon(Icons.place_outlined, size: 16),
                        label: Text(a),
                        onPressed: () => setState(() => _area = a),
                      ),
                  ]),
                ),
              if (recent.isNotEmpty && _query.isEmpty && _category == null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                    child: SectionTitle(tr('Recently viewed'),
                        trailing: TextButton(
                          onPressed: () => ref.read(recentPlacesProvider.notifier).clear(),
                          child: Text(tr('Clear')),
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
                            child: InputChip(
                              avatar: Text(Categories.emoji(p.category)),
                              label: Text(p.shownName, overflow: TextOverflow.ellipsis),
                              onPressed: () => context.push('/place/${p.id}'),
                              deleteButtonTooltipMessage: tr('Remove'),
                              onDeleted: () => ref.read(recentPlacesProvider.notifier).remove(p.id),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.sm, KSpace.md, KSpace.sm),
                  child: Text(
                      [
                        if (_closeMatches) tr('No exact matches. Showing close ones.'),
                        trf('{n} places', {'n': list.length}),
                        if (_openCount(list) > 0) trf('{n} open now', {'n': _openCount(list)}),
                      ].join(' · '),
                      style: Theme.of(context).textTheme.bodySmall),
                ),
              ),
              if (all.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    emoji: '🗺️',
                    title: tr('No places here yet'),
                    message: tr("We're still adding real places for this city."),
                  ),
                )
              else if (list.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: EmptyState(
                    emoji: '🔍',
                    title: tr('Nothing matches'),
                    message: _openNow || _extras.isNotEmpty
                        ? tr('Filters only show places whose map entry says so. Try fewer filters.')
                        : null,
                  ),
                )
              else if (_map)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
                    child: Column(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(KRadius.card),
                          child: SizedBox(
                            height: MediaQuery.sizeOf(context).height * 0.6,
                            child: KhrogaMap(
                              me: me,
                              pins: [
                                for (final p in list.where((p) => p.hasLocation).take(300))
                                  MapPin(
                                    lat: p.lat!,
                                    lng: p.lng!,
                                    label: p.name,
                                    emoji: Categories.emoji(p.category),
                                    dim: p.isOpenAt(DateTime.now()) == false,
                                    onTap: () => context.push('/place/${p.id}'),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: KSpace.sm),
                        Text(
                          list.where((p) => p.hasLocation).length > 300
                              ? tr('Showing the first 300 places. Use filters or pick an area to see others.')
                              : tr('Tap a pin to open the place. Grey pins are closed right now.'),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                )
              else if (_grid)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
                  sliver: SliverGrid.builder(
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 220,
                      mainAxisSpacing: KSpace.sm,
                      crossAxisSpacing: KSpace.sm,
                      childAspectRatio: 0.8,
                    ),
                    itemCount: list.length,
                    itemBuilder: (_, i) =>
                        PlaceGridTile(place: list[i], from: _sort == _Sort.nearest ? me : null),
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
          ),
            if (_showTop)
              PositionedDirectional(
                end: KSpace.md,
                bottom: KSpace.md,
                child: FloatingActionButton.small(
                  heroTag: null,
                  tooltip: tr('Back to top'),
                  onPressed: () => _scroll.animateTo(0,
                      duration: const Duration(milliseconds: 400), curve: Curves.easeOut),
                  child: const Icon(Icons.arrow_upward),
                ),
              ),
          ]);
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

/// Pick an area, with how many places each has and a search box.
class _AreaSheet extends StatefulWidget {
  const _AreaSheet({required this.areas, required this.counts});

  final List<String> areas;
  final Map<String, int> counts;

  @override
  State<_AreaSheet> createState() => _AreaSheetState();
}

class _AreaSheetState extends State<_AreaSheet> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final shown = widget.areas.where((a) => a.toLowerCase().contains(_q.toLowerCase())).toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (_, controller) => ListView(
        controller: controller,
        children: [
          Padding(
            padding: const EdgeInsets.all(KSpace.md),
            child: TextField(
              decoration: InputDecoration(
                hintText: tr('Find an area'),
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _q = v),
            ),
          ),
          ListTile(
            title: Text(tr('Any area'), style: TextStyle(fontWeight: FontWeight.w700)),
            onTap: () => Navigator.pop(context, ''),
          ),
          for (final a in shown)
            ListTile(
              title: Text(a),
              trailing: Text('${widget.counts[a]}', style: TextStyle(color: context.k.inkMuted)),
              onTap: () => Navigator.pop(context, a),
            ),
        ],
      ),
    );
  }
}

/// A photo card for the grid view.
class PlaceGridTile extends ConsumerWidget {
  const PlaceGridTile({super.key, required this.place, this.from});

  final Place place;

  /// When set, shows the distance from this point.
  final (double, double)? from;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push('/place/${place.id}'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: PlaceImage(
                url: place.photoUrl,
                emoji: Categories.emoji(place.category),
                width: double.infinity,
                radius: 0,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(KSpace.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(place.shownName, style: text.titleSmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(
                      [
                        if (from != null && place.hasLocation)
                          _km(haversineKm(from!.$1, from!.$2, place.lat!, place.lng!)),
                        place.area ?? place.kindLabel ?? Categories.label(place.category),
                      ].join(' · '),
                      style: text.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Row(children: [Flexible(child: OpenBadge(place: place)), PlaceMarks(id: place.id)]),
                ],
              ),
            ),
          ],
        ),
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
    final now = DateTime.now();
    final open = place.isOpenAt(now);
    if (open == null) return const SizedBox.shrink();
    // e.g. "Open · closes 23:00" or "Closed · opens 10:00 tomorrow".
    final label = place.hours?.statusText(now) ?? (open ? tr('Open now') : tr('Closed now'));
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
        Flexible(
          child: Text(label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color)),
        ),
      ],
    );
  }
}

class PlaceTile extends ConsumerWidget {
  const PlaceTile({super.key, required this.place, this.from});

  final Place place;

  /// When set, shows the distance from this point.
  final (double, double)? from;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
        onLongPress: () => showPlaceQuickActions(context, place),
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
                    Text(place.shownName,
                        style: text.titleMedium, maxLines: 1, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Text(sub, style: text.bodySmall, maxLines: 2, overflow: TextOverflow.ellipsis),
                    const SizedBox(height: 2),
                    Row(children: [Flexible(child: OpenBadge(place: place)), PlaceMarks(id: place.id)]),
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
        tr('Places: © OpenStreetMap contributors (openstreetmap.org/copyright) '
        'and Overture Maps Foundation. Map tiles: OpenStreetMap or Stadia Maps.\nPhotos from Wikimedia Commons.'),
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.bodySmall,
      ),
    );
  }
}

/// Long-press a place: favorite, add to a list, share, or open it.
Future<void> showPlaceQuickActions(BuildContext context, Place place) =>
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => Consumer(builder: (context, ref, _) {
        final fav = ref.watch(favoriteIdsProvider).value?.contains(place.id) ?? false;
        final lists = ref.watch(placeListsProvider);
        return ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.all(KSpace.md),
          children: [
            Text(place.shownName, style: Theme.of(context).textTheme.titleLarge),
            ListTile(
              leading: Icon(fav ? Icons.favorite : Icons.favorite_border),
              title: Text(fav ? tr('Remove from favorites') : tr('Add to favorites')),
              onTap: () async {
                final uid = ref.read(uidProvider);
                Navigator.pop(sheetContext);
                if (uid == null) return;
                try {
                  await ref.read(favoritesRepositoryProvider).set(uid, place.id, !fav);
                } catch (e) {
                  if (context.mounted) showError(context, e);
                }
              },
            ),
            for (final l in lists.keys)
              CheckboxListTile(
                secondary: const Icon(Icons.bookmark_outline),
                title: Text('In "$l"'),
                value: lists[l]!.contains(place.id),
                onChanged: (_) => ref.read(placeListsProvider.notifier).toggle(l, place.id),
              ),
            ListTile(
              leading: const Icon(Icons.share_outlined),
              title: Text(tr('Share')),
              onTap: () {
                Navigator.pop(sheetContext);
                SharePlus.instance.share(ShareParams(text: placeShareText(place)));
              },
            ),
            ListTile(
              leading: const Icon(Icons.open_in_new),
              title: Text(tr('Open')),
              onTap: () {
                Navigator.pop(sheetContext);
                context.push('/place/${place.id}');
              },
            ),
          ],
        );
      }),
    );

String _km(double km) => km < 1 ? '${(km * 1000).round()} m' : '${km.toStringAsFixed(1)} km';

/// Tiny ❤️ / ✅ marks when a place is a favorite or one you've been to.
class PlaceMarks extends ConsumerWidget {
  const PlaceMarks({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fav = ref.watch(favoriteIdsProvider.select((v) => v.value?.contains(id) ?? false));
    final been = ref.watch(visitedIdsProvider.select((v) => v.value?.contains(id) ?? false));
    if (!fav && !been) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 6),
      child: Text('${fav ? '❤️' : ''}${been ? '✅' : ''}', style: const TextStyle(fontSize: 12)),
    );
  }
}
