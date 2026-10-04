import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';

class PlaceDetailsScreen extends ConsumerWidget {
  const PlaceDetailsScreen({super.key, required this.placeId});

  final String placeId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final place = ref.watch(placeProvider(placeId));
    return Scaffold(
      appBar: AppBar(),
      body: AsyncView<Place?>(
        value: place,
        onRetry: () => ref.invalidate(placeProvider(placeId)),
        builder: (p) => p == null
            ? const EmptyState(emoji: '🤷', title: 'Place not found')
            : _Details(place: p),
      ),
    );
  }
}

class _Details extends ConsumerWidget {
  const _Details({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.only(bottom: KSpace.xl),
      children: [
        _PhotoStrip(place: place),
        Padding(
          padding: const EdgeInsets.all(KSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(place.name, style: text.headlineMedium),
              const SizedBox(height: KSpace.sm),
              Wrap(
                spacing: KSpace.sm,
                runSpacing: KSpace.sm,
                children: [
                  Pill('${Categories.emoji(place.category)} '
                      '${Categories.label(place.category)}'),
                  if (place.rating != null)
                    Pill('★ ${place.rating!.toStringAsFixed(1)}'
                        '${place.ratingCount != null ? ' (${place.ratingCount})' : ''}'),
                  if (place.priceLabel.isNotEmpty) Pill(place.priceLabel),
                  if (place.area != null) Pill(place.area!),
                ],
              ),
              if (place.address != null) ...[
                const SizedBox(height: KSpace.md),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.place_outlined,
                        size: 20, color: KColors.inkMuted),
                    const SizedBox(width: KSpace.sm),
                    Expanded(child: Text(place.address!)),
                  ],
                ),
              ],
              const SizedBox(height: KSpace.md),
              Wrap(
                spacing: KSpace.sm,
                runSpacing: KSpace.sm,
                children: [
                  if (place.hasLocation || place.googlePlaceId != null)
                    OutlinedButton.icon(
                      onPressed: () => openInMaps(
                        name: place.name,
                        lat: place.lat,
                        lng: place.lng,
                        googlePlaceId: place.googlePlaceId,
                      ),
                      icon: const Icon(Icons.directions_outlined),
                      label: const Text('Directions'),
                    ),
                  if (place.phone != null)
                    OutlinedButton.icon(
                      onPressed: () => callPhone(place.phone!),
                      icon: const Icon(Icons.call_outlined),
                      label: const Text('Call'),
                    ),
                  if (place.website != null)
                    OutlinedButton.icon(
                      onPressed: () => openWebsite(place.website!),
                      icon: const Icon(Icons.language),
                      label: const Text('Website'),
                    ),
                ],
              ),
              if (place.avgCostPerPerson != null) ...[
                const SectionTitle('Cost'),
                Text('~${place.avgCostPerPerson} EGP per person '
                    '(shared by Khroga users)'),
              ],
              if (place.openingHours.isNotEmpty) ...[
                const SectionTitle('Opening hours'),
                for (final line in place.openingHours)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(line, style: text.bodyMedium),
                  ),
              ],
              if (place.category == 'mall') ...[
                const SizedBox(height: KSpace.lg),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () {
                      ref.read(cityProvider.notifier).set(place.city);
                      context.push('/new-plan?mall=${place.id}');
                    },
                    icon: const Icon(Icons.auto_awesome),
                    label: const Text('Plan my day here'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// A horizontal, draggable strip of real photos with their attributions.
class _PhotoStrip extends ConsumerWidget {
  const _PhotoStrip({required this.place});

  final Place place;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (place.photos.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
        child: PlaceImage(
          url: null,
          emoji: Categories.emoji(place.category),
          height: 140,
          width: double.infinity,
          radius: KRadius.card,
        ),
      );
    }
    final photos = ref.watch(placePhotosProvider(place.id));
    return photos.when(
      loading: () => const SizedBox(
          height: 220, child: Center(child: CircularProgressIndicator())),
      // Photos are nice-to-have: if they fail, just leave them out.
      error: (_, _) => const SizedBox.shrink(),
      data: (list) {
        if (list.isEmpty) return const SizedBox.shrink();
        final credits = list
            .map((p) => p.attribution)
            .whereType<String>()
            .toSet()
            .join(', ');
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              height: 220,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: KSpace.md),
                itemCount: list.length,
                separatorBuilder: (_, _) => const SizedBox(width: KSpace.sm),
                itemBuilder: (_, i) => PlaceImage(
                  url: list[i].url,
                  emoji: Categories.emoji(place.category),
                  width: 260,
                  height: 220,
                  radius: KRadius.card,
                ),
              ),
            ),
            if (credits.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                    KSpace.md, KSpace.xs, KSpace.md, 0),
                child: Text('Photos: $credits',
                    style: Theme.of(context).textTheme.bodySmall),
              ),
          ],
        );
      },
    );
  }
}
