import '../../app/i18n.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../../widgets/khroga_map.dart';
import '../explore/explore_screen.dart';
import 'plan_form_screen.dart' show runPlanGeneration;

/// Saved plans, every plan you've made, favorite places, and places you've been.
class SavedPlansScreen extends ConsumerStatefulWidget {
  const SavedPlansScreen({super.key});

  @override
  ConsumerState<SavedPlansScreen> createState() => _SavedPlansScreenState();
}

class _SavedPlansScreenState extends ConsumerState<SavedPlansScreen> {
  int _historyLimit = 20;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text(tr('Saved')),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: context.k.ink,
            unselectedLabelColor: context.k.inkMuted,
            indicatorColor: context.k.accent,
            tabs: [
              Tab(text: tr('Saved plans')),
              Tab(text: tr('History')),
              Tab(text: tr('Favorites')),
              Tab(text: tr('Been there')),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _PlanList(
              value: ref.watch(savedPlansProvider),
              emptyEmoji: '🔖',
              emptyTitle: tr('No saved plans yet'),
              emptyMessage: tr('Tap "Save" on a plan you like and it will show up here.'),
            ),
            _PlanList(
              value: ref.watch(historyPlansProvider(_historyLimit)),
              onLoadMore: () => setState(() => _historyLimit += 20),
              pageSize: _historyLimit,
              emptyEmoji: '🕘',
              clearable: true,
              emptyTitle: tr('No plans yet'),
              emptyMessage: tr('Every plan you make shows up here.'),
            ),
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

class _PlanList extends ConsumerStatefulWidget {
  const _PlanList({
    required this.value,
    required this.emptyEmoji,
    required this.emptyTitle,
    required this.emptyMessage,
    this.clearable = false,
    this.onLoadMore,
    this.pageSize,
  });

  /// History only: loads 20 more older plans.
  final VoidCallback? onLoadMore;
  final int? pageSize;

  /// Shows "Clear unsaved" (History tab).
  final bool clearable;
  final AsyncValue<List<OutingPlan>> value;
  final String emptyEmoji;
  final String emptyTitle;
  final String emptyMessage;

  @override
  ConsumerState<_PlanList> createState() => _PlanListState();
}

class _PlanListState extends ConsumerState<_PlanList> {
  String _q = '';
  bool _oldestFirst = false;
  bool _upcoming = false;

  @override
  Widget build(BuildContext context) {
    return AsyncView<List<OutingPlan>>(
      value: widget.value,
      builder: (all) {
        if (all.isEmpty) {
          return EmptyState(
              emoji: widget.emptyEmoji,
              title: widget.emptyTitle,
              message: widget.emptyMessage,
              actionLabel: tr('Make a plan'),
              onAction: () => context.go('/plan'));
        }
        final q = _q.trim().toLowerCase();
        final today = DateTime.now();
        final todayStart = DateTime(today.year, today.month, today.day);
        final list = all
            .where((p) => !_upcoming || (p.request.date != null && !p.request.day.isBefore(todayStart)))
            .where((p) =>
                q.isEmpty ||
                p.title.toLowerCase().contains(q) ||
                p.stops.any((s) => s.name.toLowerCase().contains(q)))
            .toList();
        if (_oldestFirst) {
          list.sort((a, b) => (a.createdAt ?? DateTime(0)).compareTo(b.createdAt ?? DateTime(0)));
        }
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(KSpace.md, KSpace.md, KSpace.md, 0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                          hintText: tr('Search plans or places'),
                          prefixIcon: Icon(Icons.search),
                          isDense: true),
                      onChanged: (v) => setState(() => _q = v),
                    ),
                  ),
                  if (widget.clearable)
                    IconButton(
                      tooltip: tr('Clear plans you didn\'t save'),
                      icon: const Icon(Icons.delete_sweep_outlined),
                      onPressed: () => _clearUnsaved(all),
                    ),
                  IconButton(
                    tooltip: tr('Only upcoming outings'),
                    isSelected: _upcoming,
                    icon: const Icon(Icons.event_outlined),
                    selectedIcon: const Icon(Icons.event_available),
                    onPressed: () => setState(() => _upcoming = !_upcoming),
                  ),
                  IconButton(
                    tooltip: _oldestFirst ? tr('Newest first') : tr('Oldest first'),
                    onPressed: () => setState(() => _oldestFirst = !_oldestFirst),
                    icon: Icon(_oldestFirst ? Icons.arrow_upward : Icons.arrow_downward),
                  ),
                ],
              ),
            ),
            Expanded(child: _buildList(context, list)),
          ],
        );
      },
    );
  }

  Future<void> _clearUnsaved(List<OutingPlan> all) async {
    final unsaved = all.where((p) => !p.saved).toList();
    if (unsaved.isEmpty) {
      showMessage(context, tr('Nothing to clear: every plan here is saved.'));
      return;
    }
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(trf('Delete {n} unsaved plans?', {'n': unsaved.length})),
        content: Text(tr('Saved plans stay.')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(d, false), child: Text(tr('Cancel'))),
          FilledButton(onPressed: () => Navigator.pop(d, true), child: Text(tr('Delete'))),
        ],
      ),
    );
    final uid = ref.read(uidProvider);
    if (ok != true || uid == null) return;
    try {
      for (final p in unsaved) {
        await ref.read(plansRepositoryProvider).delete(uid, p.id);
      }
      if (mounted) showMessage(context, tr('Cleared'));
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Widget _buildList(BuildContext context, List<OutingPlan> list) {
    return ListView.separated(
              padding: const EdgeInsets.all(KSpace.md),
              itemCount: list.length + 1,
              separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
              itemBuilder: (_, i) => i == list.length
                  ? Column(children: [
                      if (widget.onLoadMore != null && list.length >= (widget.pageSize ?? 1 << 30))
                        TextButton(onPressed: widget.onLoadMore, child: Text(tr('Show older plans'))),
                      Text(tr('Swipe a plan sideways to delete it.'),
                          textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
                    ])
                  : Dismissible(
                      key: ValueKey(list[i].id),
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.symmetric(horizontal: KSpace.lg),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.errorContainer,
                          borderRadius: BorderRadius.circular(KRadius.card),
                        ),
                        child: const Icon(Icons.delete_outline),
                      ),
                      confirmDismiss: (_) => showDialog<bool>(
                        context: context,
                        builder: (dialogContext) => AlertDialog(
                          title: Text(tr('Delete this plan?')),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(dialogContext, false),
                                child: Text(tr('Cancel'))),
                            FilledButton(
                                onPressed: () => Navigator.pop(dialogContext, true),
                                child: Text(tr('Delete'))),
                          ],
                        ),
                      ),
                      onDismissed: (_) async {
                        final uid = ref.read(uidProvider);
                        if (uid == null) return;
                        try {
                          await ref.read(plansRepositoryProvider).delete(uid, list[i].id);
                        } catch (e) {
                          if (context.mounted) showError(context, e);
                        }
                      },
                      child: _SavedPlanTile(plan: list[i]),
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

class _SavedPlanTile extends StatelessWidget {
  const _SavedPlanTile({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final emojis = plan.stops.map((s) => Categories.emoji(s.category)).join(' ');
    final date = plan.request.date != null
        ? trf('for {date}', {'date': DateFormat('EEE d MMM').format(plan.request.day)})
        : plan.createdAt == null
            ? ''
            : DateFormat.MMMd().format(plan.createdAt!);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.sm),
        title: Text(plan.title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text([
          '$emojis   ${trf('{n} stops', {'n': plan.stops.length})}',
          ?plan.stops.map((s) => s.area).whereType<String>().firstOrNull,
          if (date.isNotEmpty) date,
        ].join(' · ')),
        trailing: Consumer(
          builder: (context, ref, _) => PopupMenuButton<String>(
            onSelected: (_) async {
              final exclude = {...plan.request.excludePlaceIds, ...plan.stops.map((s) => s.placeId)};
              final id = await runPlanGeneration(
                  context, ref, plan.request.copyWith(excludePlaceIds: exclude.toList()));
              if (id != null && context.mounted) context.push('/plan/$id');
            },
            itemBuilder: (_) => [
              PopupMenuItem(value: 'again', child: Text(tr('Plan again (new places)'))),
            ],
          ),
        ),
        onTap: () => context.push('/plan/${plan.id}'),
      ),
    );
  }
}
