import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../app/reminders.dart';
import 'badges_screen.dart' show badgesProvider, funPrefsProvider;
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
    if (Reminders.available) syncDailyIdeas(ref);
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

bool _ideasSynced = false;

/// Daily "place of the day" notification at 10:00 for the next week (phone
/// only, opt-in in Profile). Scheduled again each time the app opens.
Future<void> syncDailyIdeas(WidgetRef ref, {bool force = false}) async {
  if (_ideasSynced && !force) return;
  _ideasSynced = true;
  final now = DateTime.now();
  final on = ref.read(funPrefsProvider)['dailyIdea'] == '1';
  for (var i = 0; i < 8; i++) {
    final d = DateTime(now.year, now.month, now.day + i);
    await Reminders.cancel('idea:${d.year}-${d.month}-${d.day}');
  }
  if (!on) return;
  final city = ref.read(cityProvider);
  final all = (await ref.read(allPlacesProvider.future)).where((p) => p.city == city).toList();
  for (var i = 0; i < 7; i++) {
    final at = DateTime(now.year, now.month, now.day + i, 10);
    if (!at.isAfter(now)) continue;
    final p = placeOfTheDay(all, at);
    if (p == null) continue;
    await Reminders.schedule(
      key: 'idea:${at.year}-${at.month}-${at.day}',
      at: at,
      title: trf('✨ Place of the day: {place}', {'place': p.shownName}),
      body: [p.kindLabel ?? Categories.label(p.category), if (p.area != null) p.area!, tr('Tap to see it.')].join(' · '),
      route: '/place/${p.id}',
    );
  }
}
