import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../widgets/common.dart';
import '../explore/explore_screen.dart';

/// Saved plans, every plan you've made, favorite places, and places you've been.
class SavedPlansScreen extends ConsumerWidget {
  const SavedPlansScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Saved'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: context.k.ink,
            unselectedLabelColor: context.k.inkMuted,
            indicatorColor: context.k.accent,
            tabs: const [
              Tab(text: 'Saved plans'),
              Tab(text: 'History'),
              Tab(text: 'Favorites'),
              Tab(text: 'Been there'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _PlanList(
              value: ref.watch(savedPlansProvider),
              emptyEmoji: '🔖',
              emptyTitle: 'No saved plans yet',
              emptyMessage: 'Tap "Save" on a plan you like and it will show up here.',
            ),
            _PlanList(
              value: ref.watch(allPlansProvider),
              emptyEmoji: '🕘',
              emptyTitle: 'No plans yet',
              emptyMessage: 'Every plan you make shows up here.',
            ),
            _PlaceListTab(
              value: ref.watch(favoritePlacesProvider),
              emptyEmoji: '❤️',
              emptyTitle: 'No favorite places yet',
              emptyMessage: 'Tap the heart on any place to keep it here.',
            ),
            _PlaceListTab(
              value: ref.watch(visitedPlacesProvider),
              emptyEmoji: '✅',
              emptyTitle: 'No visited places yet',
              emptyMessage: 'Turn on "I\'ve been here" on a place page.',
            ),
          ],
        ),
      ),
    );
  }
}

class _PlanList extends ConsumerWidget {
  const _PlanList({
    required this.value,
    required this.emptyEmoji,
    required this.emptyTitle,
    required this.emptyMessage,
  });

  final AsyncValue<List<OutingPlan>> value;
  final String emptyEmoji;
  final String emptyTitle;
  final String emptyMessage;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncView<List<OutingPlan>>(
      value: value,
      builder: (list) => list.isEmpty
          ? EmptyState(emoji: emptyEmoji, title: emptyTitle, message: emptyMessage)
          : ListView.separated(
              padding: const EdgeInsets.all(KSpace.md),
              itemCount: list.length + 1,
              separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
              itemBuilder: (_, i) => i == list.length
                  ? Text('Swipe a plan sideways to delete it.',
                      textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall)
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
                          title: const Text('Delete this plan?'),
                          actions: [
                            TextButton(
                                onPressed: () => Navigator.pop(dialogContext, false),
                                child: const Text('Cancel')),
                            FilledButton(
                                onPressed: () => Navigator.pop(dialogContext, true),
                                child: const Text('Delete')),
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
            ),
    );
  }
}

class _PlaceListTab extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return AsyncView<List<Place>>(
      value: value,
      builder: (list) => list.isEmpty
          ? EmptyState(emoji: emptyEmoji, title: emptyTitle, message: emptyMessage)
          : ListView.separated(
              padding: const EdgeInsets.all(KSpace.md),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: KSpace.sm),
              itemBuilder: (_, i) => PlaceTile(place: list[i]),
            ),
    );
  }
}

class _SavedPlanTile extends StatelessWidget {
  const _SavedPlanTile({required this.plan});

  final OutingPlan plan;

  @override
  Widget build(BuildContext context) {
    final emojis = plan.stops.map((s) => Categories.emoji(s.category)).join(' ');
    final date = plan.createdAt == null ? '' : DateFormat.MMMd().format(plan.createdAt!);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: KSpace.md, vertical: KSpace.sm),
        title: Text(plan.title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text('$emojis   ${plan.stops.length} stops · $date'),
        trailing: const Icon(Icons.chevron_right),
        onTap: () => context.push('/plan/${plan.id}'),
      ),
    );
  }
}
