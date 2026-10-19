import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/helpers.dart' show timeAgo;
import '../../app/i18n.dart';
import '../../app/local_prefs.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../models/review.dart';
import '../../widgets/common.dart';
import 'review_screens.dart' show starsText;

final _friendsReviewsProvider = FutureProvider.autoDispose<List<Review>>(
  (ref) => ref.watch(reviewsRepositoryProvider).friendsLatest(ref.watch(friendUidsProvider)),
);

/// What your friends reviewed lately (read once when opened).
class FriendsReviewsScreen extends ConsumerWidget {
  const FriendsReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final places = {for (final p in ref.watch(allPlacesProvider).value ?? const <Place>[]) p.id: p};
    final blocked = ref.watch(blockedUsersProvider);
    final now = DateTime.now();
    return Scaffold(
      appBar: AppBar(title: Text(tr("Friends' reviews"))),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(_friendsReviewsProvider.future),
        child: AsyncView<List<Review>>(
          value: ref.watch(_friendsReviewsProvider),
          onRetry: () => ref.invalidate(_friendsReviewsProvider),
          builder: (all) {
            final list = all.where((r) => !blocked.containsKey(r.uid)).toList();
            if (list.isEmpty) {
              return EmptyState(
                emoji: '✍️',
                title: tr('No reviews from friends yet'),
                message: tr('When your friends review places, they show up here.'),
                actionLabel: tr('Find friends'),
                onAction: () => context.go('/friends'),
              );
            }
            return ListView(
              padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
              children: [
                for (final r in list)
                  Card(
                    child: ListTile(
                      leading: Text(Categories.emoji(r.category), style: const TextStyle(fontSize: 26)),
                      title: Text(places[r.placeId]?.shownName ?? tr('A place')),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${r.name} · ${starsText(r.stars)}${r.updatedAt == null ? '' : ' · ${timeAgo(r.updatedAt!, now)}'}',
                            style: TextStyle(color: context.k.accent),
                          ),
                          if (r.text.isNotEmpty) Text(r.text, maxLines: 3, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                      onTap: places.containsKey(r.placeId) ? () => context.push('/place/${r.placeId}') : null,
                      onLongPress: () => context.push('/person/${r.uid}'),
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
