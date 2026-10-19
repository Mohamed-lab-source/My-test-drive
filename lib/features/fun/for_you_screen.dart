import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/fun.dart';
import '../../app/i18n.dart';
import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../explore/explore_screen.dart' show PlaceTile;

/// Places picked for you from the kinds and areas you visit and save, that
/// you haven't been to yet. All real places; the reason is shown.
class ForYouScreen extends ConsumerWidget {
  const ForYouScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final city = ref.watch(cityProvider);
    final visited = ref.watch(visitedPlacesProvider).value ?? const <Place>[];
    final favorites = ref.watch(favoritePlacesProvider).value ?? const <Place>[];
    final here = ref.watch(myLocationProvider);
    return Scaffold(
      appBar: AppBar(title: Text(tr('For you'))),
      body: AsyncView<List<Place>>(
        value: ref.watch(allPlacesProvider),
        onRetry: () => ref.invalidate(allPlacesProvider),
        builder: (all) {
          final picks = forYou(all, visited, favorites, city);
          if (picks.isEmpty) {
            return EmptyState(
              emoji: '🔮',
              title: tr('Save or visit a few places first'),
              message: tr('Tap ❤️ or "Been there" on places you like, and we\'ll suggest similar ones.'),
              actionLabel: tr('Explore places'),
              onAction: () => context.go('/explore'),
            );
          }
          return ListView(
            padding: const EdgeInsets.only(bottom: KSpace.xl),
            children: [
              for (final s in picks) ...[
                PlaceTile(place: s.place, from: here),
                Padding(
                  padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xs),
                  child: Text(
                    s.area == null
                        ? trf('Because you like {kind}', {'kind': Categories.label(s.category!)})
                        : trf('Because you like {kind} in {area}', {
                            'kind': Categories.label(s.category!),
                            'area': s.area!,
                          }),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: context.k.inkMuted),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
