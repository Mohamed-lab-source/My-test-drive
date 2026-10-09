import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart';
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../../widgets/share_card.dart';
import '../../app/share_texts.dart';

/// Your outings in numbers: only from your own account and this phone.
class MyStatsScreen extends ConsumerWidget {
  const MyStatsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final visited = ref.watch(visitedPlacesProvider).value ?? const <Place>[];
    final favorites = ref.watch(favoritePlacesProvider).value ?? const <Place>[];
    final plans = ref.watch(recentPlansProvider).value ?? const <OutingPlan>[];
    final count = ref.watch(plansCountProvider).value;
    final ratings = ref.watch(myRatingsProvider);
    final lists = ref.watch(placeListsProvider);
    final now = DateTime.now();
    final streak = weekStreak(plans.map((p) => p.createdAt).whereType<DateTime>(), now);
    final byCat = countBy(visited, (p) => p.category);
    final byArea = countBy(visited, (p) => p.area).take(8).toList();
    final byCity = countBy(visited, (p) => p.city);
    final notTried = Categories.all.keys
        .where((c) => c != 'shop' && !byCat.any((e) => e.$1 == c))
        .toList();
    final stopsPlanned = plans.fold<int>(0, (s, p) => s + p.stops.length);
    final vibes = countBy(plans.expand((p) => p.request.vibes), (v) => v).take(3).toList();

    Widget tile(String emoji, String value, String label) => Expanded(
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.sm),
              child: Column(children: [
                Text(emoji, style: const TextStyle(fontSize: 22)),
                Text(value, style: text.titleLarge),
                Text(label, style: text.bodySmall, textAlign: TextAlign.center, maxLines: 2),
              ]),
            ),
          ),
        );

    Widget bars(List<(String, int)> rows, String Function(String) label) {
      final max = rows.isEmpty ? 1 : rows.first.$2;
      return Column(children: [
        for (final (k, n) in rows)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(children: [
              SizedBox(width: 130, child: Text(label(k), maxLines: 1, overflow: TextOverflow.ellipsis)),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: n / max,
                    minHeight: 10,
                    color: context.k.accent,
                    backgroundColor: context.k.accent.withValues(alpha: 0.12),
                  ),
                ),
              ),
              SizedBox(width: 36, child: Text('$n', textAlign: TextAlign.end)),
            ]),
          ),
      ]);
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(tr('My outings in numbers')),
        actions: [
          IconButton(
            tooltip: tr('Share as a picture'),
            icon: const Icon(Icons.ios_share),
            onPressed: () => sharePictureCard(
              context,
              StoryCard(
                emoji: '📊',
                title: tr('My outings in numbers'),
                subtitle: tr('On Khroga'),
                lines: [
                  ('🗺️', trf('{n} plans made', {'n': count ?? plans.length}), null),
                  ('✅', trf("{n} places I've been", {'n': visited.length}), null),
                  if (streak > 0) ('🔥', trf('{n} weeks in a row', {'n': streak}), null),
                  if (byArea.isNotEmpty) ('🏘️', trf('Top area: {area}', {'area': byArea.first.$1}), null),
                  if (byCat.isNotEmpty)
                    (Categories.emoji(byCat.first.$1), trf('Most visited: {kind}', {'kind': Categories.label(byCat.first.$1)}), null),
                ],
              ),
              appInviteText(),
            ),
          ),
          IconButton(
            tooltip: tr('My map'),
            icon: const Icon(Icons.map_outlined),
            onPressed: () => context.push('/my-map'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Row(children: [
            tile('🗺️', '${count ?? plans.length}', tr('Plans made')),
            tile('✅', '${visited.length}', tr("Places you've been")),
            tile('❤️', '${favorites.length}', tr('Favorites')),
          ]),
          Row(children: [
            tile('🔥', '$streak', tr('Weeks in a row with a plan')),
            tile('⭐', '${ratings.length}', tr('Places you rated')),
            tile('📋', '${lists.length}', tr('Your lists')),
          ]),
          if (stopsPlanned > 0)
            Padding(
              padding: const EdgeInsets.only(top: KSpace.sm),
              child: Text(trf('Your last {n} plans had {s} stops in total.', {'n': plans.length, 's': stopsPlanned}),
                  style: text.bodySmall),
            ),
          if (vibes.isNotEmpty) ...[
            SectionTitle(tr('Your favorite vibes')),
            Wrap(spacing: KSpace.sm, children: [
              for (final (v, n) in vibes) Chip(label: Text('${tr(Vibes.all[v] ?? v)} · $n')),
            ]),
          ],
          if (byCat.isNotEmpty) ...[
            SectionTitle(tr("Kinds of places you've been")),
            bars(byCat, (c) => '${Categories.emoji(c)} ${Categories.label(c)}'),
          ],
          if (byArea.isNotEmpty) ...[
            SectionTitle(tr('Your top areas')),
            bars(byArea, (a) => a),
          ],
          if (byCity.length > 1) ...[
            SectionTitle(tr('Cities')),
            bars(byCity, (c) => tr(Cities.all[c] ?? c)),
          ],
          if (notTried.isNotEmpty && visited.isNotEmpty) ...[
            SectionTitle(tr("Something you haven't tried yet")),
            Wrap(spacing: KSpace.sm, runSpacing: KSpace.sm, children: [
              for (final c in notTried) Chip(label: Text('${Categories.emoji(c)} ${Categories.label(c)}')),
            ]),
          ],
          if (visited.isEmpty)
            EmptyState(
              emoji: '✅',
              title: tr('Mark places you\'ve been'),
              message: tr('Tap "Been there" on a place page and your stats fill in here.'),
            ),
        ],
      ),
    );
  }
}

enum _Show { all, favorites, visited }

/// Your favorites and the places you've been, on one map.
class MyMapScreen extends ConsumerStatefulWidget {
  const MyMapScreen({super.key});

  @override
  ConsumerState<MyMapScreen> createState() => _MyMapScreenState();
}

class _MyMapScreenState extends ConsumerState<MyMapScreen> {
  _Show _show = _Show.all;

  @override
  Widget build(BuildContext context) {
    final visited = ref.watch(visitedPlacesProvider).value ?? const <Place>[];
    final favorites = ref.watch(favoritePlacesProvider).value ?? const <Place>[];
    final beenIds = {for (final p in visited) p.id};
    final favIds = {for (final p in favorites) p.id};
    final places = {
      if (_show != _Show.visited) for (final p in favorites) p.id: p,
      if (_show != _Show.favorites) for (final p in visited) p.id: p,
    }.values.where((p) => p.hasLocation).toList();
    return Scaffold(
      appBar: AppBar(title: Text(tr('My map'))),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.sm),
          child: SegmentedButton<_Show>(
            showSelectedIcon: false,
            segments: [
              ButtonSegment(value: _Show.all, label: Text(tr('All'))),
              ButtonSegment(value: _Show.favorites, label: Text('❤️ ${favorites.length}')),
              ButtonSegment(value: _Show.visited, label: Text('✅ ${visited.length}')),
            ],
            selected: {_show},
            onSelectionChanged: (s) => setState(() => _show = s.first),
          ),
        ),
        Expanded(
          child: places.isEmpty
              ? EmptyState(
                  emoji: '🗺️',
                  title: tr('Nothing on your map yet'),
                  message: tr('Save favorites or mark places you\'ve been, and they show up here.'),
                )
              : KhrogaMap(pins: [
                  for (final p in places.take(300))
                    MapPin(
                      lat: p.lat!,
                      lng: p.lng!,
                      label: p.shownName,
                      emoji: beenIds.contains(p.id) ? '✅' : (favIds.contains(p.id) ? '❤️' : '📍'),
                      onTap: () => context.push('/place/${p.id}'),
                    ),
                ]),
        ),
      ]),
    );
  }
}
