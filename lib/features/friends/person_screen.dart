import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/review.dart';
import '../../models/social.dart';
import '../../widgets/common.dart';
import '../reviews/review_screens.dart' show starsText;

/// Someone's public side: name, guide level and badges, and their newest
/// public reviews (read once: 1 + 1 + up to 10 small documents).
final _personProvider = FutureProvider.autoDispose.family<(ReviewerStats, List<Review>), String>((ref, uid) async {
  final repo = ref.watch(reviewsRepositoryProvider);
  final stats = await repo.reviewerStats(uid);
  final reviews = stats.total == 0 ? const <Review>[] : await repo.mine(uid, limit: 10);
  return (stats, reviews);
});

class PersonScreen extends ConsumerWidget {
  const PersonScreen({super.key, required this.uid});

  final String uid;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final me = ref.watch(uidProvider);
    final profile = ref.watch(profilesProvider(uid)).value?[uid];
    final blocked = ref.watch(blockedUsersProvider).containsKey(uid);
    final friendship = (ref.watch(friendshipsProvider).value ?? const <Friendship>[])
        .where((f) => me != null && f.otherUid(me) == uid)
        .firstOrNull;
    final places = {for (final p in ref.watch(allPlacesProvider).value ?? const <Place>[]) p.id: p};
    return Scaffold(
      appBar: AppBar(title: Text(profile?.displayName ?? tr('Profile'))),
      body: blocked
          ? EmptyState(
              emoji: '🚫',
              title: tr('You blocked this person'),
              actionLabel: tr('Unblock'),
              onAction: () => ref.read(blockedUsersProvider.notifier).set(uid, null),
            )
          : AsyncView<(ReviewerStats, List<Review>)>(
              value: ref.watch(_personProvider(uid)),
              onRetry: () => ref.invalidate(_personProvider(uid)),
              builder: (data) {
                final (stats, reviews) = data;
                final tier = tierFor(stats.points);
                final next = nextTier(stats.points);
                return ListView(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
                  children: [
                    Center(child: Avatar(profile: profile, size: 80)),
                    const SizedBox(height: KSpace.sm),
                    Center(child: Text(profile?.displayName ?? '…', style: text.titleLarge)),
                    if (profile?.username != null)
                      Center(
                        child: Text(
                          '@${profile!.username}',
                          style: text.bodyMedium?.copyWith(color: context.k.inkMuted),
                        ),
                      ),
                    const SizedBox(height: KSpace.md),
                    Card(
                      child: ListTile(
                        leading: Text(tier.emoji, style: const TextStyle(fontSize: 30)),
                        title: Text(tier.name),
                        subtitle: Text(
                          [
                            trf('{n} points', {'n': stats.points}),
                            trf('{n} reviews', {'n': stats.total}),
                            if (next != null) trf('{n} to {tier}', {'n': next.$2, 'tier': next.$1.name}),
                          ].join(' · '),
                        ),
                      ),
                    ),
                    if (expertBadgesFor(stats) case final badges when badges.isNotEmpty)
                      Wrap(
                        spacing: KSpace.sm,
                        children: [for (final b in badges) Chip(label: Text('${b.emoji} ${b.name}'))],
                      ),
                    if (me != null && uid != me) ...[
                      const SizedBox(height: KSpace.sm),
                      if (friendship?.status == FriendshipStatus.accepted)
                        Center(child: Text(tr('🤝 You\'re friends'), style: text.bodyMedium))
                      else if (friendship == null)
                        OutlinedButton.icon(
                          onPressed: () => context.push('/add-friend/$uid'),
                          icon: const Icon(Icons.person_add_alt),
                          label: Text(tr('Add friend')),
                        )
                      else
                        Center(child: Text(tr('Friend request pending'), style: text.bodyMedium)),
                    ],
                    SectionTitle(tr('Newest reviews')),
                    if (reviews.isEmpty)
                      Text(tr('No reviews yet.'), style: text.bodyMedium)
                    else
                      for (final r in reviews)
                        Card(
                          child: ListTile(
                            leading: Text(Categories.emoji(r.category), style: const TextStyle(fontSize: 24)),
                            title: Text(places[r.placeId]?.shownName ?? tr('A place')),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(starsText(r.stars), style: TextStyle(color: context.k.accent)),
                                if (r.text.isNotEmpty) Text(r.text, maxLines: 3, overflow: TextOverflow.ellipsis),
                              ],
                            ),
                            onTap: places.containsKey(r.placeId) ? () => context.push('/place/${r.placeId}') : null,
                          ),
                        ),
                  ],
                );
              },
            ),
    );
  }
}
