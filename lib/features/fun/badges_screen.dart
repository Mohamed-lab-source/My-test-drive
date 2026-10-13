import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/extras.dart' show weekStreak;
import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/share_texts.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/plan.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/confetti.dart';
import '../../widgets/share_card.dart';

/// Phone-only game state: badges already celebrated, monthly goal, etc.
final funPrefsProvider = NotifierProvider<StringMapPref, Map<String, String>>(() => StringMapPref('fun'));

/// Your badges, from data the app already has loaded (no extra reads).
final badgesProvider = Provider<List<OutingBadge>>((ref) {
  final visited = ref.watch(visitedPlacesProvider).value ?? const <Place>[];
  final recent = ref.watch(recentPlansProvider).value ?? const <OutingPlan>[];
  final reviewer = ref.watch(myReviewerStatsProvider).value;
  final counts = countsFromVisited(
    visited,
    plans: ref.watch(plansCountProvider).value ?? recent.length,
    savedPlans: recent.where((p) => p.saved).length,
    favorites: ref.watch(favoriteIdsProvider).value?.length ?? 0,
    groups: ref.watch(myGroupsProvider).value?.length ?? 0,
    friends: ref.watch(friendshipsProvider).value?.where((f) => f.status == FriendshipStatus.accepted).length ?? 0,
    reviews: reviewer?.total ?? 0,
    detailedReviews: reviewer?.detailed ?? 0,
    lists: ref.watch(placeListsProvider).length,
    ratings: ref.watch(myRatingsProvider).length,
    weekStreak: weekStreak(recent.map((p) => p.createdAt).whereType<DateTime>(), DateTime.now()),
  );
  return allBadges(counts);
});

/// Celebrates badges earned since last time (once each), with confetti.
/// The first time, everything already earned is just remembered quietly.
void celebrateNewBadges(BuildContext context, WidgetRef ref) {
  final badges = ref.read(badgesProvider);
  final prefs = ref.read(funPrefsProvider);
  final notifier = ref.read(funPrefsProvider.notifier);
  final seenRaw = prefs['badges'];
  final earned = {
    for (final b in badges)
      if (b.earned) b.key,
  };
  if (seenRaw == null) {
    notifier.set('badges', earned.isEmpty ? ',' : earned.join(','));
    return;
  }
  final fresh = newBadges(badges, seenRaw.split(',').toSet());
  if (fresh.isEmpty) return;
  notifier.set('badges', {...seenRaw.split(',').where((s) => s.isNotEmpty), ...earned}.join(','));
  showDialog<void>(
    context: context,
    builder: (_) => _NewBadgeDialog(badge: fresh.first, more: fresh.length - 1),
  );
}

class _NewBadgeDialog extends StatelessWidget {
  const _NewBadgeDialog({required this.badge, required this.more});

  final OutingBadge badge;
  final int more;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    return AlertDialog(
      content: Stack(
        alignment: Alignment.topCenter,
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: KSpace.md),
              Text(badge.emoji, style: const TextStyle(fontSize: 64)),
              Text(tr('New badge!'), style: text.labelLarge?.copyWith(color: context.k.accent)),
              Text(badge.title, style: text.headlineSmall, textAlign: TextAlign.center),
              const SizedBox(height: KSpace.xs),
              Text(badge.hint, style: text.bodyMedium, textAlign: TextAlign.center),
              if (more > 0) ...[
                const SizedBox(height: KSpace.sm),
                Text(trf('And {n} more!', {'n': more}), style: text.bodySmall),
              ],
            ],
          ),
          const Confetti(),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            shareBadge(context, badge);
          },
          child: Text(tr('Share')),
        ),
        TextButton(
          onPressed: () {
            Navigator.pop(context);
            context.push('/badges');
          },
          child: Text(tr('All badges')),
        ),
        FilledButton(onPressed: () => Navigator.pop(context), child: Text(tr('Yay!'))),
      ],
    );
  }
}

void shareBadge(BuildContext context, OutingBadge b) => sharePictureCard(
  context,
  StoryCard(emoji: b.emoji, title: b.title, subtitle: tr('New badge on Khroga'), lines: [('🏆', b.hint, null)]),
  appInviteText(),
);

/// All badges with how close you are to each.
class BadgesScreen extends ConsumerWidget {
  const BadgesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final badges = ref.watch(badgesProvider);
    final earned = badges.where((b) => b.earned).toList();
    final next = badges.where((b) => !b.earned).toList()..sort((a, b) => b.progress.compareTo(a.progress));
    return Scaffold(
      appBar: AppBar(title: Text(tr('Badges'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(KSpace.md),
              child: Row(
                children: [
                  SizedBox(
                    width: 64,
                    height: 64,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        CircularProgressIndicator(
                          value: badges.isEmpty ? 0 : earned.length / badges.length,
                          strokeWidth: 7,
                          backgroundColor: context.k.accentSoft,
                          color: context.k.accent,
                        ),
                        Text('${earned.length}', style: text.titleLarge),
                      ],
                    ),
                  ),
                  const SizedBox(width: KSpace.md),
                  Expanded(
                    child: Text(
                      trf('{a} of {b} badges earned', {'a': earned.length, 'b': badges.length}),
                      style: text.titleMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (next.isNotEmpty) ...[SectionTitle(tr('Closest next')), for (final b in next.take(3)) _BadgeRow(badge: b)],
          if (earned.isNotEmpty) ...[SectionTitle(tr('Earned')), for (final b in earned) _BadgeRow(badge: b)],
          if (next.length > 3) ...[
            SectionTitle(tr('Still to earn')),
            for (final b in next.skip(3)) _BadgeRow(badge: b),
          ],
        ],
      ),
    );
  }
}

class _BadgeRow extends StatelessWidget {
  const _BadgeRow({required this.badge});

  final OutingBadge badge;

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final b = badge;
    return Card(
      child: ListTile(
        leading: Opacity(
          opacity: b.earned ? 1 : 0.4,
          child: Text(b.emoji, style: const TextStyle(fontSize: 30)),
        ),
        title: Text(b.title),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(b.hint),
            if (!b.earned) ...[
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: b.progress,
                  minHeight: 7,
                  color: context.k.accent,
                  backgroundColor: context.k.accentSoft,
                ),
              ),
              Text('${b.have.clamp(0, b.need)} / ${b.need}', style: text.bodySmall),
            ],
          ],
        ),
        trailing: b.earned
            ? IconButton(
                tooltip: tr('Share'),
                icon: const Icon(Icons.ios_share),
                onPressed: () => shareBadge(context, b),
              )
            : null,
      ),
    );
  }
}

/// Profile card: earned badges at a glance, opens the full list.
class BadgesSummaryCard extends ConsumerStatefulWidget {
  const BadgesSummaryCard({super.key});

  @override
  ConsumerState<BadgesSummaryCard> createState() => _BadgesSummaryCardState();
}

class _BadgesSummaryCardState extends ConsumerState<BadgesSummaryCard> {
  @override
  void initState() {
    super.initState();
    // Wait a moment so the numbers have loaded before celebrating.
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted && ref.read(visitedIdsProvider).hasValue) celebrateNewBadges(context, ref);
    });
  }

  @override
  Widget build(BuildContext context) {
    final text = Theme.of(context).textTheme;
    final badges = ref.watch(badgesProvider);
    final earned = badges.where((b) => b.earned).toList();
    final next =
        (badges.where((b) => !b.earned).toList()..sort((a, b) => b.progress.compareTo(a.progress))).firstOrNull;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(KRadius.card),
        onTap: () => context.push('/badges'),
        child: Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      trf('Badges · {a} of {b}', {'a': earned.length, 'b': badges.length}),
                      style: text.titleMedium,
                    ),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: KSpace.xs),
              Text(
                earned.isEmpty ? '🏅' : earned.reversed.take(10).map((b) => b.emoji).join(' '),
                style: const TextStyle(fontSize: 24),
              ),
              if (next != null) ...[
                const SizedBox(height: KSpace.xs),
                Text(
                  trf('Next: {badge} ({a}/{b})', {
                    'badge': '${next.emoji} ${next.title}',
                    'a': next.have,
                    'b': next.need,
                  }),
                  style: text.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
