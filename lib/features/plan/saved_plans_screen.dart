import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../explore/explore_screen.dart';

/// Your places: favorites and places you've been (plans live in My plans).
class SavedPlansScreen extends ConsumerStatefulWidget {
  const SavedPlansScreen({super.key, this.beenThere = false});

  /// Open on "Been there" instead of Favorites.
  final bool beenThere;

  @override
  ConsumerState<SavedPlansScreen> createState() => _SavedPlansScreenState();
}

class _SavedPlansScreenState extends ConsumerState<SavedPlansScreen> {
  @override
  Widget build(BuildContext context) {
    // Plans live in the My plans tab; this screen is your places.
    return DefaultTabController(
      length: 2,
      initialIndex: widget.beenThere ? 1 : 0,
      child: Scaffold(
        appBar: AppBar(
          title: Text(tr('Saved places')),
          bottom: TabBar(
            labelColor: context.k.ink,
            unselectedLabelColor: context.k.inkMuted,
            indicatorColor: context.k.accent,
            tabs: [
              Tab(text: tr('Favorites')),
              Tab(text: tr('Been there')),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _PlaceListTab(
              value: ref.watch(favoritePlacesProvider),
              emptyEmoji: '❤️',
              emptyTitle: tr('No favorite places yet'),
              emptyMessage: tr('Tap the heart on any place to keep it here.'),
            ),
            _PlaceListTab(
              value: ref.watch(visitedPlacesProvider),
              emptyEmoji: '✅',
              emptyTitle: tr('No visited places yet'),
              emptyMessage: tr('Turn on "I\'ve been here" on a place page.'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PlaceListTab extends StatefulWidget {
  const _PlaceListTab({
    required this.value,
    required this.emptyEmoji,
    required this.emptyTitle,
    required this.emptyMessage,
  });

  final AsyncValue<List<Place>> value;
  final String emptyEmoji;
  final String emptyTitle;
  final String emptyMessage;

  @override
  State<_PlaceListTab> createState() => _PlaceListTabState();
}

class _PlaceListTabState extends State<_PlaceListTab> {
  bool _map = false;
  bool _az = false;

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<Place>>(
      value: widget.value,
      builder: (raw) {
        final list = _sorted(raw);
        return list.isEmpty
          ? EmptyState(
              emoji: widget.emptyEmoji,
              title: widget.emptyTitle,
              message: widget.emptyMessage,
              actionLabel: tr('Explore places'),
              onAction: () => context.go('/explore'))
          : Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    TextButton.icon(
                      onPressed: () => setState(() => _az = !_az),
                      icon: Icon(_az ? Icons.sort_by_alpha : Icons.schedule),
                      label: Text(_az ? tr('A–Z') : tr('Newest first')),
                    ),
                    TextButton.icon(
                    onPressed: () => setState(() => _map = !_map),
                    icon: Icon(_map ? Icons.view_list_outlined : Icons.map_outlined),
                    label: Text(_map ? tr('List') : tr('Map')),
                  ),
                  ],
                ),
                Expanded(
                  child: _map
                      ? KhrogaMap(pins: [
                          for (final p in list.where((p) => p.hasLocation))
                            MapPin(
                              lat: p.lat!,
                              lng: p.lng!,
                              label: p.name,
                              emoji: Categories.emoji(p.category),
                              onTap: () => context.push('/place/${p.id}'),
                            ),
                        ])
                      : ListView.separated(
              padding: const EdgeInsets.all(KSpace.md),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
              itemBuilder: (_, i) => PlaceTile(place: list[i]),
            ),
                ),
              ],
            );
      },
    );
  }

  List<Place> _sorted(List<Place> list) => _az
      ? ([...list]..sort((a, b) => a.shownName.toLowerCase().compareTo(b.shownName.toLowerCase())))
      : list;
}
