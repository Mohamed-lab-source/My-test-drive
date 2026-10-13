import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart';
import '../../app/fun.dart' show areaProgress;
import '../../app/helpers.dart' show normalizeSearch;
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../explore/explore_screen.dart' show PlaceTile, OsmCredit;

/// Every neighbourhood we have places in, with how many.
class AreasScreen extends ConsumerStatefulWidget {
  const AreasScreen({super.key});

  @override
  ConsumerState<AreasScreen> createState() => _AreasScreenState();
}

class _AreasScreenState extends ConsumerState<AreasScreen> {
  String _q = '';
  bool _az = false;

  @override
  Widget build(BuildContext context) {
    final city = ref.watch(cityProvider);
    final areas = ref.watch(areaCentersProvider(city));
    return Scaffold(
      appBar: AppBar(
        title: Text(tr('Areas')),
        actions: [
          IconButton(
            tooltip: _az ? tr('Most places first') : tr('A–Z'),
            icon: Icon(_az ? Icons.sort : Icons.sort_by_alpha),
            onPressed: () => setState(() => _az = !_az),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.sm),
            child: SegmentedButton<String>(
              showSelectedIcon: false,
              segments: [
                for (final e in Cities.all.entries)
                  ButtonSegment(value: e.key, label: Text(tr(e.value))),
              ],
              selected: {city},
              onSelectionChanged: (s) => ref.read(cityProvider.notifier).set(s.first),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
            child: TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: tr('Find an area'),
              ),
              onChanged: (v) => setState(() => _q = normalizeSearch(latinDigits(v))),
            ),
          ),
          Expanded(
            child: AsyncView(
              value: areas,
              builder: (list) {
                final shown = list.where((a) => _q.isEmpty || normalizeSearch(a.name).contains(_q)).toList();
                if (_az) shown.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
                if (shown.isEmpty) {
                  return EmptyState(emoji: '🏘️', title: tr('No areas found'));
                }
                final visited = (ref.watch(visitedIdsProvider).value ?? const <String>[]).toSet();
                final all = ref.watch(allPlacesProvider).value ?? const <Place>[];
                final been = {
                  for (final a in areaProgress(all, visited, city, minPlaces: 1))
                    if (a.been > 0) a.area: a.been,
                };
                return ListView.builder(
                  padding: const EdgeInsets.only(bottom: KSpace.xl),
                  itemCount: shown.length + 1,
                  itemBuilder: (_, index) {
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.sm, KSpace.md, 0),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(trf("🗺️ You've explored {a} of {b} areas", {'a': been.length, 'b': list.length}),
                              style: Theme.of(context).textTheme.titleSmall),
                          const SizedBox(height: 4),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: LinearProgressIndicator(
                              value: list.isEmpty ? 0 : been.length / list.length,
                              minHeight: 8,
                              color: context.k.accent,
                              backgroundColor: context.k.accentSoft,
                            ),
                          ),
                        ]),
                      );
                    }
                    final a = shown[index - 1];
                    final b = been[a.name] ?? 0;
                    return ListTile(
                      leading: CircleAvatar(
                        backgroundColor: b > 0 ? context.k.accent : null,
                        foregroundColor: b > 0 ? context.k.onAccent : null,
                        child: Text(b > 0 ? '✓' : initialsOf(a.name)),
                      ),
                      title: Text(a.name),
                      subtitle: Text(b > 0
                          ? trf("{n} places · you've been to {b}", {'n': a.count, 'b': b})
                          : trf('{n} places', {'n': a.count})),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push(
                          '/area/$city/${Uri.encodeComponent(a.name)}'),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// One neighbourhood: what's there, on a map, and "Plan an outing here".
class AreaScreen extends ConsumerStatefulWidget {
  const AreaScreen({super.key, required this.city, required this.name});

  final String city;
  final String name;

  @override
  ConsumerState<AreaScreen> createState() => _AreaScreenState();
}

class _AreaScreenState extends ConsumerState<AreaScreen> {
  String? _category;
  bool _openNow = false;
  bool _showMap = false;
  int _limit = 30;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final all = ref.watch(allPlacesProvider);
    final visited = ref.watch(visitedIdsProvider).value ?? const <String>[];
    return Scaffold(
      appBar: AppBar(title: Text(widget.name)),
      body: AsyncView<List<Place>>(
        value: all,
        builder: (places) {
          final here = placesInArea(places, widget.city, widget.name);
          if (here.isEmpty) {
            return EmptyState(emoji: '🏘️', title: tr('No places here yet'));
          }
          final now = DateTime.now();
          final cats = countBy(here, (p) => p.category);
          final shown = here
              .where((p) => _category == null || p.category == _category)
              .where((p) => !_openNow || p.isOpenAt(now) == true)
              .toList();
          final center = centerOf(here);
          final been = here.where((p) => visited.contains(p.id)).length;
          final openCount = here.where((p) => p.isOpenAt(now) == true).length;
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              Text(
                [
                  trf('{n} places', {'n': here.length}),
                  if (openCount > 0) trf('{n} open now', {'n': openCount}),
                  if (been > 0) trf("{n} you've been to", {'n': been}),
                ].join(' · '),
                style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
              ),
              const SizedBox(height: KSpace.sm),
              Wrap(
                spacing: KSpace.sm,
                runSpacing: KSpace.sm,
                children: [
                  if (center != null)
                    FilledButton.icon(
                      icon: const Icon(Icons.auto_awesome),
                      label: Text(tr('Plan an outing here')),
                      onPressed: () => context.push(Uri(path: '/new-plan', queryParameters: {
                        'lat': '${center.$1}',
                        'lng': '${center.$2}',
                        'label': widget.name,
                      }).toString()),
                    ),
                  OutlinedButton.icon(
                    icon: Icon(_showMap ? Icons.list : Icons.map_outlined),
                    label: Text(_showMap ? tr('Hide map') : tr('Show on map')),
                    onPressed: () => setState(() => _showMap = !_showMap),
                  ),
                ],
              ),
              const SizedBox(height: KSpace.sm),
              Wrap(
                spacing: KSpace.sm,
                runSpacing: KSpace.sm,
                children: [
                  ChoiceChip(
                    label: Text(tr('All')),
                    selected: _category == null,
                    showCheckmark: false,
                    onSelected: (_) => setState(() => _category = null),
                  ),
                  for (final (c, n) in cats)
                    ChoiceChip(
                      label: Text('${Categories.emoji(c)} ${Categories.label(c)} · $n'),
                      selected: _category == c,
                      showCheckmark: false,
                      onSelected: (_) => setState(() => _category = c),
                    ),
                  FilterChip(
                    avatar: const Icon(Icons.schedule, size: 18),
                    label: Text(tr('Open now')),
                    selected: _openNow,
                    showCheckmark: false,
                    onSelected: (v) => setState(() => _openNow = v),
                  ),
                ],
              ),
              if (_showMap) ...[
                const SizedBox(height: KSpace.md),
                ClipRRect(
                  borderRadius: BorderRadius.circular(KRadius.card),
                  child: SizedBox(
                    height: 320,
                    child: KhrogaMap(pins: [
                      for (final p in shown.where((p) => p.hasLocation).take(200))
                        MapPin(
                          lat: p.lat!,
                          lng: p.lng!,
                          label: p.shownName,
                          emoji: Categories.emoji(p.category),
                          onTap: () => context.push('/place/${p.id}'),
                        ),
                    ]),
                  ),
                ),
              ],
              const SizedBox(height: KSpace.sm),
              if (shown.isEmpty)
                EmptyState(emoji: '🔍', title: tr('Nothing matches'))
              else ...[
                for (final p in shown.take(_limit)) PlaceTile(place: p),
                if (shown.length > _limit)
                  TextButton(
                    onPressed: () => setState(() => _limit += 30),
                    child: Text(trf('Show more ({n} left)', {'n': shown.length - _limit})),
                  ),
              ],
              const OsmCredit(),
            ],
          );
        },
      ),
    );
  }
}
