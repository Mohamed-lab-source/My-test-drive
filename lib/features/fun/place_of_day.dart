import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import 'badges_screen.dart' show badgesProvider;
import 'bingo_screen.dart' show visitedThisMonth;

/// "Place of the day": one well-documented real place in your city, the
/// same for everyone today, plus your bingo and badge progress.
class PlaceOfDayCard extends ConsumerWidget {
  const PlaceOfDayCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    final city = ref.watch(cityProvider);
    final all = ref.watch(allPlacesProvider).value;
    if (all == null) return const SizedBox.shrink();
    final now = DateTime.now();
    final place = placeOfTheDay(all.where((p) => p.city == city).toList(), now);
    final visited = ref.watch(visitedDatedProvider).value ?? const <(Place, DateTime?)>[];
    final card = bingoFor(now);
    final ticks = bingoDone(card, visitedThisMonth(visited, now)).where((d) => d).length;
    final badges = ref.watch(badgesProvider);
    final earned = badges.where((b) => b.earned).length;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (place != null)
          Card(
            margin: const EdgeInsets.only(top: KSpace.md),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => context.push('/place/${place.id}'),
              child: Row(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(KSpace.sm),
                    child: PlaceImage(
                      url: place.photoUrl,
                      emoji: Categories.emoji(place.category),
                      width: 76,
                      height: 76,
                    ),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(KSpace.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tr('✨ Place of the day'), style: text.labelMedium?.copyWith(color: context.k.accent)),
                          Text(place.shownName, maxLines: 1, overflow: TextOverflow.ellipsis, style: text.titleMedium),
                          Text(
                            [
                              place.kindLabel ?? Categories.label(place.category),
                              if (place.area != null) place.area!,
                            ].join(' · '),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: text.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Padding(
                    padding: EdgeInsets.only(right: KSpace.sm),
                    child: Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            ActionChip(
              avatar: const Text('🎯'),
              label: Text(trf('Bingo {n}/9', {'n': ticks})),
              onPressed: () => context.push('/bingo'),
            ),
            ActionChip(
              avatar: const Text('🏅'),
              label: Text(trf('Badges {a}/{b}', {'a': earned, 'b': badges.length})),
              onPressed: () => context.push('/badges'),
            ),
            ActionChip(avatar: const Text('🎉'), label: Text(tr('My recap')), onPressed: () => context.push('/recap')),
          ],
        ),
      ],
    );
  }
}
