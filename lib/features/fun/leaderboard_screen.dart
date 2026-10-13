import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/share_texts.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/review.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../../widgets/share_card.dart';

/// You and your friends' reviewer stats (public `reviewerStats` docs), read
/// once when the screen opens: one small read per person.
final _boardProvider = FutureProvider.autoDispose<List<(String, ReviewerStats)>>((ref) async {
  final me = ref.watch(uidProvider);
  if (me == null) return const [];
  final uids = {me, ...ref.watch(friendUidsProvider)}.take(60).toList();
  final stats = await ref.watch(reviewsRepositoryProvider).reviewerStatsFor(uids);
  final rows = [for (final u in uids) (u, stats[u] ?? const ReviewerStats())]
    ..sort((a, b) => b.$2.points.compareTo(a.$2.points));
  return rows;
});

/// Friends leaderboard by guide points (from reviews).
class LeaderboardScreen extends ConsumerWidget {
  const LeaderboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(uidProvider);
    final board = ref.watch(_boardProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('Friends leaderboard'))),
      body: AsyncView(
        value: board,
        onRetry: () => ref.invalidate(_boardProvider),
        builder: (rows) {
          final profiles = rows.isEmpty
              ? const <String, PublicProfile>{}
              : ref.watch(profilesProvider(rows.map((r) => r.$1).join(','))).value ?? const <String, PublicProfile>{};
          String nameOf(String uid) => uid == me ? tr('You') : profiles[uid]?.displayName ?? tr('Friend');
          final myRank = rows.indexWhere((r) => r.$1 == me) + 1;
          return ListView(
            padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
            children: [
              Text(
                tr('Points come from reviews: 10 per review, 10 more when it\'s detailed.'),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: KSpace.sm),
              if (rows.length <= 1)
                EmptyState(
                  emoji: '🤝',
                  title: tr('Add friends to compete'),
                  message: tr('Your friends show up here with their guide level.'),
                  actionLabel: tr('Find friends'),
                  onAction: () => context.go('/friends'),
                ),
              for (final (i, (uid, s)) in rows.indexed)
                Card(
                  color: uid == me ? context.k.accentSoft : null,
                  child: ListTile(
                    leading: SizedBox(
                      width: 36,
                      child: Center(
                        child: Text(
                          i < 3 ? ['🥇', '🥈', '🥉'][i] : '${i + 1}',
                          style: TextStyle(fontSize: i < 3 ? 26 : 18, fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    title: Text(nameOf(uid), maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(guideTitle(s)),
                    trailing: Text(trf('{n} pts', {'n': s.points}), style: Theme.of(context).textTheme.titleMedium),
                  ),
                ),
              if (rows.length > 1 && myRank > 0) ...[
                const SizedBox(height: KSpace.md),
                OutlinedButton.icon(
                  onPressed: () => sharePictureCard(
                    context,
                    StoryCard(
                      emoji: '🏆',
                      title: trf("I'm #{n} among my friends", {'n': myRank}),
                      subtitle: tr('Khroga reviewers'),
                      lines: [
                        for (final (i, (uid, s)) in rows.take(5).indexed)
                          (i < 3 ? ['🥇', '🥈', '🥉'][i] : '${i + 1}', nameOf(uid), trf('{n} pts', {'n': s.points})),
                      ],
                    ),
                    appInviteText(),
                  ),
                  icon: const Icon(Icons.ios_share),
                  label: Text(tr('Share the leaderboard')),
                ),
                TextButton(onPressed: () => context.push('/guide'), child: Text(tr('How to earn points'))),
              ],
            ],
          );
        },
      ),
    );
  }
}
