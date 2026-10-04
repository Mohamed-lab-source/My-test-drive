import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../data/providers.dart';
import '../../models/place.dart';
import '../../widgets/common.dart';
import '../../widgets/launchers.dart';
import 'explore_screen.dart';

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
      padding: const EdgeInsets.fromLTRB(KSpace.md, 0, KSpace.md, KSpace.xl),
      children: [
        Container(
          height: 120,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: KColors.accentSoft,
            borderRadius: BorderRadius.circular(KRadius.card),
          ),
          child: Text(Categories.emoji(place.category),
              style: const TextStyle(fontSize: 56)),
        ),
        const SizedBox(height: KSpace.md),
        Text(place.name, style: text.headlineMedium),
        if (place.nameAr != null && place.nameAr != place.name)
          Text(place.nameAr!,
              textDirection: TextDirection.rtl,
              style: text.titleMedium?.copyWith(color: KColors.inkMuted)),
        const SizedBox(height: KSpace.sm),
        Wrap(
          spacing: KSpace.sm,
          runSpacing: KSpace.sm,
          children: [
            Pill('${Categories.emoji(place.category)} '
                '${Categories.label(place.category)}'),
            if (place.area != null) Pill(place.area!),
            if (place.cuisineLabel != null) Pill(place.cuisineLabel!),
          ],
        ),
        if (place.address != null) ...[
          const SizedBox(height: KSpace.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.place_outlined, size: 20, color: KColors.inkMuted),
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
            if (place.hasLocation)
              OutlinedButton.icon(
                onPressed: () =>
                    openInMaps(name: place.name, lat: place.lat, lng: place.lng),
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
        if (place.openingHours != null) ...[
          const SectionTitle('Opening hours'),
          Text(_friendlyHours(place.openingHours!), style: text.bodyMedium),
          const SizedBox(height: KSpace.xs),
          Text('Hours can change. Call ahead if it matters.', style: text.bodySmall),
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
        const SizedBox(height: KSpace.lg),
        if (place.osmUrl != null)
          TextButton(
            onPressed: () => openWebsite(place.osmUrl!),
            child: const Text('Something wrong? Fix it on OpenStreetMap'),
          ),
        const OsmCredit(),
      ],
    );
  }

  /// Makes OpenStreetMap's short day names readable ("Mo-Fr" → "Mon–Fri").
  static String _friendlyHours(String raw) {
    const days = {
      'Mo': 'Mon', 'Tu': 'Tue', 'We': 'Wed', 'Th': 'Thu',
      'Fr': 'Fri', 'Sa': 'Sat', 'Su': 'Sun', 'PH': 'Holidays',
    };
    var out = raw;
    days.forEach((k, v) => out = out.replaceAll(RegExp('\\b$k\\b'), v));
    return out
        .replaceAll('24/7', 'Open 24 hours')
        .replaceAll('; ', '\n')
        .replaceAll(';', '\n')
        .replaceAll(' off', ' closed');
  }
}
